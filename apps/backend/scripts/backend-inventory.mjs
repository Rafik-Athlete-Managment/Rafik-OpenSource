import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { resolve, dirname, relative } from "node:path";
import ts from "typescript";
import { backendRoot, repositoryRoot } from "./prisma/docker.mjs";
import {
  migrationDigest,
  migrationSource,
  refreshSchemaSnapshot,
} from "./backend-schema-snapshot.mjs";
if (process.argv.includes("--refresh-database")) await refreshSchemaSnapshot();
const snapshot = JSON.parse(
  readFileSync(
    resolve(
      repositoryRoot,
      "docs/verification/receipts/backend-schema-catalog.json",
    ),
    "utf8",
  ),
);
if (snapshot.migrationDigest !== migrationDigest())
  throw Error(
    "Schema snapshot is stale. Run npm run backend:inventory:database against local Docker.",
  );
const metadata = JSON.parse(
  readFileSync(resolve(backendRoot, "scripts/backend-inventory.json"), "utf8"),
);
const output = resolve(repositoryRoot, "docs/reference/backend");
const directTouches = new Map();
const schema = readFileSync(
  resolve(backendRoot, "prisma/schema.prisma"),
  "utf8",
);
const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(
  (m) => ({
    name: m[1],
    source: m[2],
    qualified:
      (m[2].match(/@@schema\("([^" ]+)"\)/)?.[1] || "public") +
      "." +
      (m[2].match(/@@map\("([^" ]+)"\)/)?.[1] || m[1]),
  }),
);
const modelByTable = new Map(models.map((m) => [m.qualified, m]));
const tableByModel = new Map(models.map((m) => [m.name, m.qualified]));
const tableByName = new Map(
  snapshot.tables.map((t) => [t.name, t.schema + "." + t.name]),
);
const escape = (x) =>
  String(x ?? "—")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ")
    .replaceAll("`", "'");
const slug = (x) => x.toLowerCase().replaceAll(".", "");
const tableLink = (x) => `[${x}](schema.md#${slug(x)})`;
const unique = (xs) => [...new Set(xs)].sort();
const walk = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((n) => {
      const p = resolve(dir, n);
      return statSync(p).isDirectory() ? walk(p) : [p];
    });
const serverFiles = walk(resolve(backendRoot, "server")).filter(
  (p) => p.endsWith(".ts") && !p.includes("generated"),
);
const asts = new Map(
  serverFiles.map((file) => [
    file,
    ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    ),
  ]),
);
const functions = new Map(),
  imports = new Map();
for (const [file, ast] of asts) {
  const local = new Map();
  for (const node of ast.statements) {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      node.moduleSpecifier.text.startsWith(".")
    ) {
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings))
        for (const b of bindings.elements)
          local.set(b.name.text, {
            file: resolve(dirname(file), node.moduleSpecifier.text),
            name: b.propertyName?.text || b.name.text,
          });
    }
    if (ts.isFunctionDeclaration(node) && node.name)
      functions.set(file + "#" + node.name.text, {
        file,
        name: node.name.text,
        node,
      });
    if (ts.isVariableStatement(node))
      for (const declaration of node.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.initializer &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
        )
          functions.set(file + "#" + declaration.name.text, {
            file,
            name: declaration.name.text,
            node: declaration.initializer,
          });
  }
  imports.set(file, local);
}
function tablesIn(source) {
  const found = [];
  for (const m of models) {
    if (
      new RegExp("\\b(?:tx|db)\\." + m.name + "\\b").test(source) ||
      new RegExp("\\b" + m.qualified.replace(".", "\\.") + "\\b").test(source)
    )
      found.push(m.qualified);
    if (
      new RegExp(
        "\\b(?:FROM|JOIN|INTO|UPDATE|DELETE FROM)\\s+(?:public\\.)?" +
          m.qualified.split(".")[1] +
          "\\b",
        "i",
      ).test(source)
    )
      found.push(m.qualified);
  }
  return unique(found);
}
const sqlBodies = new Map();
const identifierNames = JSON.parse(
  readFileSync(resolve(backendRoot, "scripts/institution-names.json"), "utf8"),
);
const currentIdentifiers = (source) => {
  for (const [old, current] of Object.entries(identifierNames).sort(
    (a, b) => b[0].length - a[0].length,
  ))
    source = source.replaceAll(old, current);
  return source
    .replaceAll("workspace_id", "institution_id")
    .replaceAll("organization_member_today", "institution_member_today")
    .replaceAll(
      "guard_organization_booking_conflict",
      "guard_institution_booking_conflict",
    );
};
for (const [, original] of migrationSource())
  for (const m of currentIdentifiers(original).matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?(\w+)[\s\S]*?\$\$([\s\S]*?)\$\$/gi,
  ))
    sqlBodies.set(m[1], m[2]);
const liveSql = new Set(snapshot.functions.map((f) => f.name));
function sqlTables(name, seen = new Set()) {
  if (seen.has(name) || !liveSql.has(name)) return [];
  seen.add(name);
  const body = sqlBodies.get(name) || "";
  let tables = tablesIn(body);
  for (const m of body.matchAll(/\b(?:public\.)?(\w+)\s*\(/g))
    if (liveSql.has(m[1])) tables.push(...sqlTables(m[1], seen));
  return unique(tables);
}
function touches(file, name, seen = new Set()) {
  const key = file + "#" + name;
  if (seen.has(key)) return [];
  seen.add(key);
  const fn = functions.get(key);
  if (!fn) return [];
  const body = fn.node.getText();
  let tables = tablesIn(body);
  const visit = (node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const target = imports.get(file)?.get(node.expression.text) || {
        file,
        name: node.expression.text,
      };
      tables.push(...touches(target.file, target.name, seen));
    }
    ts.forEachChild(node, visit);
  };
  visit(fn.node);
  for (const m of body.matchAll(/public\.(\w+)\s*\(/g))
    tables.push(...sqlTables(m[1]));
  return unique(tables);
}
const index = resolve(backendRoot, "server/index.ts"),
  indexAst = asts.get(index);
const anchors = new Set(["serveApiDocs"]);
const visit = (node) => {
  if (
    ts.isVariableDeclaration(node) &&
    node.initializer &&
    ts.isCallExpression(node.initializer) &&
    ts.isPropertyAccessExpression(node.initializer.expression) &&
    node.initializer.expression.expression.getText() === "path" &&
    node.initializer.expression.name.text === "match"
  )
    anchors.add(node.name.getText());
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    node.left.getText() === "path" &&
    ts.isStringLiteral(node.right)
  )
    anchors.add(node.right.text);
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.expression.getText() === "path" &&
    node.expression.name.text === "startsWith" &&
    ts.isStringLiteral(node.arguments[0])
  )
    anchors.add(node.arguments[0].text);
  ts.forEachChild(node, visit);
};
visit(indexAst);
const missing = [...anchors].filter(
  (a) => !metadata.routes.some((r) => r.anchor === a),
);
if (missing.length)
  throw Error("Unreviewed route registrations: " + missing.join(", "));
for (const r of metadata.routes) {
  if (!anchors.has(r.anchor)) throw Error("Stale route metadata: " + r.anchor);
  for (const handler of r.handlers)
    if (!imports.get(index)?.has(handler))
      throw Error("Missing route handler import: " + handler);
}
for (const model of models)
  if (!metadata.models[model.name])
    throw Error("Unreviewed model: " + model.name);
for (const name of Object.keys(metadata.models))
  if (!models.some((m) => m.name === name))
    throw Error("Stale model metadata: " + name);
for (const t of snapshot.tables)
  if (!modelByTable.has(t.schema + "." + t.name))
    throw Error("SQL table missing from Prisma: " + t.schema + "." + t.name);
// A current catalog must agree with every maintained physical scalar field.
for (const table of snapshot.tables) {
  const model = modelByTable.get(table.schema + "." + table.name);
  const fields = new Map(
    [...model.source.matchAll(/^\s+(\w+)\s+(\w+(?:\[\]|\?)?)/gm)].map(
      (match) => [match[1], match[2]],
    ),
  );
  for (const column of table.columns) {
    const type = fields.get(column.name);
    if (
      !type ||
      (!type.endsWith("[]") && type.endsWith("?") !== column.nullable)
    )
      throw Error(
        "Prisma/catalog field mismatch: " + model.name + "." + column.name,
      );
  }
}
for (const [handler, prefix] of [
  ["authRoute", "/v1/auth/"],
  ["mobileAuthRoute", "/v1/mobile/auth/"],
]) {
  const imported = imports.get(index).get(handler),
    fn = functions.get(imported.file + "#" + imported.name);
  for (const match of fn.node.getText().matchAll(/path === "([^" ]+)"/g))
    if (!metadata.routes.some((route) => route.path === prefix + match[1]))
      throw Error("Unreviewed auth operation: " + prefix + match[1]);
}
const commands = [],
  queries = [];
const purposes = {
  adaptation:
    "Assignment-local immutable prescription snapshot and revision; source library version is retained and changes are audited.",
  accepted_by: "Account that consumed the invitation.",
  answers: "Historical form response values.",
  data: "Institution exercise metadata snapshot.",
  device_name:
    "Human-readable native device label; not an authorization grant.",
  fields: "Historical form field definitions and units.",
  form_revision: "Version of the historical form used by this request.",
  template_revision:
    "Frozen assessment-template revision used by this occurrence.",
  id: "Stable record identity; singleton tables constrain this to the one installation row.",
  institution_id:
    "Institution scope key retained for compatibility; never a browser-selected tenant.",
  member_id:
    "Institution membership subject; distinct from global account identity.",
  user_id: "Global account subject.",
  athlete_member_id: "Athlete membership subject.",
  coach_member_id: "Coach membership with explicit relationship scope.",
  trainer_id:
    "Primary-coach membership mirror, not an additional role on the athlete.",
  revision: "Optimistic record revision checked before edits.",
  version: "Workout/document version used by exact write/replay checks.",
  version_id: "Immutable published program version identity.",
  created_at: "Record creation timestamp.",
  updated_at: "Last recorded update timestamp.",
  created_by:
    "Attributed creator identity; the foreign key identifies account versus membership scope.",
  recorded_by: "Attributed recorder identity.",
  recorded_at: "Recorded result/history timestamp.",
  day_id: "Published workout day identity.",
  local_date: "Recorded workout date, independent of UTC day boundaries.",
  training_date:
    "Event-local calendar date derived from timestamp and timezone.",
  starts_at: "Fixed occurrence/booking start instant.",
  ends_at: "Fixed occurrence/booking end instant.",
  start_date: "Inclusive assignment start date.",
  end_date: "Optional inclusive assignment end date.",
  starts_on: "Inclusive recurrence date-range start.",
  ends_on: "Inclusive recurrence date-range end.",
  state:
    "Record lifecycle state; SQL constraints and the handler govern valid transitions.",
  status: "Workout/support lifecycle status; it is not evidence of attendance.",
  active:
    "Current enabled membership/record state; historical records are retained.",
  archived: "Archived identity/draft flag; archival is not data deletion.",
  name: "Display name for this entity.",
  name_ar: "Arabic display name.",
  title: "Human-readable title.",
  body: "Message/notification content; scoped private data.",
  subject: "Support/notification subject.",
  detail:
    "Support details or attributed audit detail, depending on this table.",
  definition:
    "Assessment definition, result types, units and bounds; occurrences keep their own snapshot.",
  prescription: "Immutable exercise/program prescription snapshot.",
  document:
    "Workout prescription, actual measurements, notes and recorded version.",
  draft: "Editable program prescription before publication.",
  draft_version:
    "Optimistic draft revision; distinct from published version number.",
  payload:
    "Original operation/provider request payload retained for exact identity/history.",
  result: "Saved operation response returned on an exact retry.",
  entries: "Versioned per-set actual measurements.",
  values:
    "Recorded assessment/measurement values, interpreted using their definition.",
  source_snapshot:
    "Frozen assignment/version/day prescription source; never replaced by today's draft.",
  workout_snapshot:
    "Shared workout baseline and sequence source for a training occurrence.",
  sequence_cursor:
    "Next zero-based independent assignment position; booking does not consume it.",
  cycle: "Zero-based repeated plan-cycle number; no automatic load increase.",
  position: "Stable sequence/order position within the owning record.",
  operation_id: "Original durable command identity; retries keep this value.",
  request_hash:
    "Digest of the exact sensitive request; not its cleartext contents.",
  result_revision: "Acknowledged result revision.",
  resolved_by:
    "Attributed member who explicitly completed/skipped this sequence position.",
  resolved_at: "Explicit sequence resolution time.",
  reason:
    "Staff explanation for an explicit lifecycle decision, such as a skip.",
  roles:
    "Stored role array; current institution membership permits exactly one role.",
  role: "Historical team role; not a current role-switching control.",
  duty: "Event roster role: staff or athlete (trainee compatibility value).",
  attendance:
    "Participant attendance; absence/unmarked is not workout completion.",
  email: "Account/invitation identifier; not verified by this deployment flow.",
  email_confirmed_at:
    "Historical identity metadata; do not infer an active email-verification flow.",
  password_hash: "Password hash; never plaintext or a public API field.",
  token_hash: "One-way token hash; never the usable token.",
  access_token_hash: "Hash of a short-lived native access token.",
  refresh_token_hash: "Hash of the current rotating native refresh token.",
  previous_refresh_token_hash:
    "Previous native refresh hash used for safe retry detection.",
  expires_at: "Expiration instant.",
  expires_on: "Expiration calendar date.",
  access_expires_at: "Native access-token expiry.",
  absolute_expires_at: "Absolute native-session expiry.",
  revoked_at: "Explicit native-session revocation time.",
  locale: "Account language choice (English/Arabic).",
  units: "Preferred measurement units.",
  unit: "Measurement unit paired with the stored value.",
  timezone: "IANA timezone used for date/clock interpretation.",
  display_name: "Account display name.",
  note: "Scoped user-entered note; not a place to bypass health-record permissions.",
  notes: "Historical relationship notes retained for own-account export.",
  coach_note: "Explicit coach review note, separate from athlete actuals.",
  session_note: "Participant event note, separate from score values.",
  feedback: "Explicit review feedback.",
  reviewed_at: "Coach review timestamp.",
  completed_at:
    "Workout completion timestamp; independent from event attendance.",
  completed: "History/set completion flag; not automatic group completion.",
  started_at: "Workout start timestamp.",
  recorded_mode:
    "Self versus delegated recording; the athlete remains the subject.",
  actor_id: "Account actor responsible for this command/audit.",
  actor_member_id: "Membership actor responsible for this result version.",
  action: "Attributed operation/history action.",
  owner_id: "Owning account/member identity; see its scoped foreign key.",
  author_id: "Attributed content author.",
  sender_id: "Institution message sender membership.",
  reporter_id: "Account that created the local support case.",
  bytes: "Declared stored file size in bytes.",
  filename: "Original display filename; never an unchecked storage path.",
  media_type: "Validated file MIME type.",
  object_path: "Historical private-byte storage key.",
  metadata: "Historical object metadata, including MIME and size.",
  digest: "Pinned byte/content digest.",
  logo: "Validated installation logo bytes.",
  logo_mime: "Validated logo MIME type.",
  accent: "Configured installation accent color.",
  background_light: "Configured light surface/background color.",
  background_dark: "Configured dark surface/background color.",
  participation:
    "Explicit non-diagnostic modified/unavailable participation status.",
  effective_from: "Date from which a participation status applies.",
  age_group: "Product consent category: adult or minor.",
  guardian_authorized:
    "Whether the product guardian prerequisite is acknowledged.",
  athlete_assented_at: "Athlete assent timestamp.",
  assent_policy_version: "Acknowledged product assent policy version.",
  guardian_verified_at: "Recorded guardian prerequisite verification time.",
  guardian_verified_by:
    "Account that recorded guardian prerequisite verification.",
  withdrawn_at: "Consent withdrawal time.",
  closed_at: "Participation record closure time used by retention.",
  quiet_start: "Quiet-hours start hour in the account timezone.",
  quiet_end: "Quiet-hours end hour.",
  categories: "Explicit notification category/channel preferences.",
  not_before: "Earliest permitted notification delivery attempt.",
  attempts: "Recorded delivery attempts, not proof of delivery.",
  read_at: "User read acknowledgment timestamp.",
  last_sequence: "Last acknowledged message sequence.",
  last_seen_at: "Native device/session last-used timestamp.",
  last_response_revision: "Last acknowledged response revision.",
  reps: "Actual repetition count.",
  load: "Actual external load paired with unit.",
  seconds: "Actual duration in seconds.",
  metres: "Actual distance in metres.",
  effort: "Explicit recorded effort value.",
  set_index: "Zero-based exercise set ordinal.",
  exercise_key: "Stable prescription exercise key.",
  goal: "Explicit goal label for concurrent assignments.",
  goals: "Historical relationship goals.",
  constraints: "Historical relationship constraints; private exported context.",
  schedule_mode:
    "Legacy/current assignment scheduling mode; sequence rules are handled explicitly.",
  weekdays: "ISO weekday numbers selected for bounded weekly recurrence.",
  local_time:
    "Optional recurrence clock time; null is reserved for later day-only support.",
  duration_minutes: "Fixed occurrence duration in minutes.",
  local_start: "Historical local date/time source used to create availability.",
  score: "Explicit submitted rating/result; missing is not neutral.",
  month: "Month-start date for explicit workplace feedback.",
  basis: "Food nutrient reference amount.",
  quantity: "Actual consumed quantity.",
  nutrients: "Stored nutrient source values; unknown is distinct from zero.",
  food: "Food source snapshot.",
  meal: "Actual consumed meal/food snapshot.",
  meals: "Suggested meal plan, not actual consumption.",
  guidance: "Explicit nutrition guidance.",
  logged_on: "Consumption local date.",
  measured_on: "Historical measurement date.",
  metric: "Historical measurement kind.",
  value: "Stored metric value paired with its unit/definition.",
  kind: "Entity variant; consult SQL constraints and the relevant handler.",
  purpose:
    "File-use boundary (message/resource/exercise), not unrestricted sharing.",
  source: "Reference provenance identifier.",
  source_kind: "Notification/reference source category.",
  source_id: "Referenced source identity.",
  source_ref: "Pinned external/reference source key.",
  source_revision: "Referenced content revision.",
  source_group: "Imported reference grouping key.",
  equipment: "Exercise equipment classification.",
  equipment_ar: "Arabic equipment label.",
  instructions: "Exercise instructions.",
  instructions_ar: "Arabic exercise instructions.",
  movement: "Exercise movement classification.",
  category: "Exercise/notification classification.",
  body_part: "Exercise body-region metadata.",
  target_muscle: "Exercise target-muscle metadata.",
  targets: "Per-set prescribed targets.",
  media_url: "Historical reviewed media URL.",
  media_ref: "Pinned reference-media identity.",
  listed: "Published/library visibility; assignment remains explicit.",
  is_public: "Historical/reference snapshot public visibility.",
  public:
    "Historical bucket public flag; private byte access still follows authorization.",
  retired: "File retirement flag; cleanup follows reference/grace rules.",
  removed: "Recorded removal state; not deletion of unrelated history.",
  cancelled: "Explicit cancelled request state.",
  suspended:
    "Operator account suspension, separate from membership revocation.",
  request_id: "Linked historical coaching request identity.",
  relationship_id: "Historical private coach/athlete pair identity.",
  team_id: "Historical team scope; not an additional current institution.",
  team_template_id: "Historical copied team-plan source identity.",
  pending_coach_id: "Historical pending reassignment destination.",
  private_pair: "Frozen direct-channel participant identities.",
  private_pair_key:
    "Canonical pair key preventing duplicate direct conversations.",
  sequence: "Ordered message/provider event position.",
  event_key: "Stable notification source deduplication key.",
  occurrence_key: "Historical assignment/date/day replay identity.",
  scheduled_date: "Explicit historical scheduled workout date.",
  due_date: "Historical form/request due date.",
  target_date: "Target local date for the owning guidance/record.",
  effective_on: "Historical plan-effective calendar date.",
  staff_limit:
    "Historical commercial staff allowance; not enforced by current institution APIs.",
  client_limit:
    "Historical commercial athlete allowance; not a current entitlement.",
  access_until: "Historical commercial access date retained for export only.",
  provider_sequence:
    "Historical provider ordering checkpoint; no new provider mutation endpoint.",
  applied:
    "Whether a historical provider receipt updated its account at the time.",
  key: "Stable limiter/key identity.",
  count: "Limiter/window count.",
  window_start: "Rate-limit window start.",
  singleton: "One-row installation constraint.",
  enabled: "Explicit configured feature/record flag.",
  configured_at: "Configuration timestamp.",
  configured_by: "Attributed configuration account.",
  last_accept: "Last recorded acceptance checkpoint.",
  raw_user_meta_data:
    "Account metadata; never a source of authorization grants.",
  manager: "Historical team management flag.",
  joined_at: "Membership join time.",
  ended_at: "Coaching-link end time; history remains.",
  ended_by: "Actor ending the link.",
  published_at: "Immutable source publication timestamp.",
  submitted_at: "Historical response submission timestamp.",
  reply: "Explicit support reply content.",
  closed_count: "Non-identifying retention aggregate count of closed records.",
  purged_count: "Non-identifying retention aggregate count of purged records.",
  allowed_mime_types: "Historical bucket MIME allowlist.",
  file_size_limit: "Historical bucket upload size cap.",
  intended_email: "Historical invitation intended account identifier.",
  location: "Human-readable occurrence location.",
  makeup_for:
    "Explicit participant makeup link; no commercial allowance accounting.",
  checked_in_at: "Participant check-in timestamp.",
  client_ids: "Historical selected athlete account identities.",
  sport_ids: "Selected sport/specialty identities frozen on the invitation.",
  timing_mode:
    "Explicit timed appointment or day-only training; governs null timestamps and local-date handling.",
  last_generated_on:
    "Last rule-local date materialized without advancing the assignment sequence.",
  last_checked_at:
    "Most recent worker evaluation; oldest-first bounded polling checkpoint.",
  issue:
    "General preparation diagnostic, without clinical details or an implication of medical clearance.",
};
function fieldPurpose(table, column) {
  const k = column.name;
  if (purposes[k]) return purposes[k];
  if (k.endsWith("_id"))
    return (
      "Linked " +
      k.slice(0, -3).replaceAll("_", " ") +
      " identity; scope and target are shown in the foreign keys below."
    );
  throw Error("Missing reviewed field purpose: " + table + "." + k);
}
let schemaMd =
  "# Backend schema reference\n\nGenerated from a fresh migrated PostgreSQL catalog and reviewed purpose metadata. This is schema/source evidence, not production-data or runtime authorization acceptance. Regenerate with `npm run backend:inventory`; refresh the catalog after migrations with `npm run backend:inventory:database`.\n\n";
schemaMd += `${snapshot.tables.length} physical tables; ${snapshot.tables.reduce((n, t) => n + t.columns.length, 0)} columns. SQL constraints, policies and triggers are authoritative; Prisma relations are not additional physical columns. Full raw catalog: [verification receipt](../../verification/receipts/backend-schema-catalog.json).\n\n## Table index\n\n| Table | Domain | Treatment | Purpose |\n| --- | --- | --- | --- |\n`;
for (const t of snapshot.tables) {
  const q = t.schema + "." + t.name,
    m = modelByTable.get(q),
    info = metadata.models[m.name];
  schemaMd += `| [${q}](#${slug(q)}) | ${info.domain} | ${info.disposition} | ${escape(info.purpose)} |\n`;
}
for (const t of snapshot.tables) {
  const q = t.schema + "." + t.name,
    m = modelByTable.get(q),
    info = metadata.models[m.name];
  const incoming = snapshot.tables.filter((other) =>
    other.constraints.some(
      (c) =>
        c.kind === "f" &&
        (c.target === q || (c.target === t.name && t.schema === "public")),
    ),
  );
  const modules = serverFiles
    .filter((file) => {
      if (!directTouches.has(file))
        directTouches.set(file, tablesIn(readFileSync(file, "utf8")));
      return directTouches.get(file).includes(q);
    })
    .map(
      (file) =>
        `[${relative(backendRoot, file).replaceAll("\\", "/")}](../../../apps/backend/${relative(backendRoot, file).replaceAll("\\", "/")})`,
    );
  schemaMd += `\n## ${q}\n\n${info.purpose}\n\n- Prisma model: \`${m.name}\`; domain: ${info.domain}; treatment: **${info.disposition}**.\n- Direct server source references: ${modules.join(", ") || "No literal server reference; retained SQL/reference/export dependencies are described in the audit."}.\n- Referenced by: ${incoming.map((x) => tableLink(x.schema + "." + x.name)).join(", ") || "No incoming SQL foreign key"}.\n- Access: RLS ${t.rls ? "enabled" : "not enabled"}; guest SELECT ${t.grants.guest_select}; user SELECT ${t.grants.user_select}; server SELECT ${t.grants.api_select}. Grants alone never publish an HTTP operation.\n\n| Field | PostgreSQL type | Nullable | Default | Purpose |\n| --- | --- | --- | --- | --- |\n`;
  for (const c of t.columns)
    schemaMd += `| \`${c.name}\` | \`${escape(c.type)}\` | ${c.nullable ? "yes" : "no"} | ${c.default === null ? "—" : "\`" + escape(c.default) + "\`"} | ${escape(fieldPurpose(q, c))} |\n`;
  schemaMd +=
    "\n<details>\n<summary>Relationships, constraints, indexes, policies and triggers</summary>\n\n";
  for (const c of t.constraints)
    schemaMd += `- \`${c.name}\`: \`${escape(c.definition)}\`\n`;
  schemaMd +=
    "\n```sql\n" + [...t.indexes, ...t.triggers].join(";\n") + ";\n```\n\n";
  for (const p of t.policies)
    schemaMd += `- Policy \`${p.name}\` (${p.command}): USING \`${escape(p.using)}\`; CHECK \`${escape(p.check)}\`.\n`;
  schemaMd += "\n</details>\n";
}
let routesMd =
  "# Backend route reference\n\nGenerated from reviewed registrations in `server/index.ts`, authentication/doc dispatchers, handler call graphs and schema metadata. Methods listed are implemented routes, not proposed URLs. The canonical OpenAPI remains the supported field/API contract subset. Dynamic request URLs can be assembled in shared client helpers; the consumer description is reviewed, while literal matches are only source evidence.\n\n";
routesMd +=
  "## Route and data-flow map\n\n```mermaid\nflowchart LR\n Web[Web dashboard] --> HTTP[Explicit HTTP routes]\n Android[Android field app] --> HTTP\n HTTP --> Auth[Identity and current authority]\n Auth --> Domain[Institution domain services]\n Domain --> Records[Scoped records and history]\n Domain --> Receipts[Exact operation receipts]\n HTTP --> Account[Explicit profile, support and own-account lifecycle]\n HTTP --> Bytes[Authorized byte adapters]\n```\n\n## Registered routes\n\n";
for (const route of metadata.routes) {
  let tables = [];
  for (const handler of route.handlers) {
    const imp = imports.get(index)?.get(handler);
    if (imp) tables.push(...touches(imp.file, imp.name));
  }
  if (route.path.includes("queries/"))
    tables.push(...queries.map((q) => tableByName.get(q)).filter(Boolean));
  if (route.path.includes("commands/"))
    for (const name of commands) tables.push(...sqlTables(name));
  tables = unique(tables);
  routesMd += `### ${route.methods.join(" / ")} ${route.path}\n\n${route.purpose}.\n\n- Authority: ${route.access}.\n- Apps/workflow: ${route.clients}.\n- Handler: ${
    route.handlers
      .map((name) => {
        const imp = imports.get(index).get(name);
        return (
          "[" +
          name +
          "](../../../apps/backend/" +
          relative(backendRoot, imp.file).replaceAll("\\", "/") +
          ")"
        );
      })
      .join(", ") || "Inline liveness query"
  }.\n- Source-derived table touches (including known called helpers/SQL functions): ${tables.map(tableLink).join(", ") || "Static reference/byte content; no direct table dependency found"}.\n\n`;
}
routesMd +=
  "## Retired surfaces\n\nGeneric commands/queries, standalone file transport, workspace/context and organization-prefixed aliases are removed. Use explicit account/support and institution endpoints. Published beta.2 clients require replacement for beta.3; no legacy route fallback is provided. Historical migration sources remain immutable.\n";
// Explicit counts guard review metadata; output is deterministic and contains no application data.
mkdirSync(output, { recursive: true });
for (const [name, source] of [
  ["schema.md", schemaMd],
  ["routes.md", routesMd],
]) {
  const normalized = source.replaceAll("\\`", "`");
  const path = resolve(output, name);
  if (process.argv.includes("--check")) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== normalized)
      throw Error("Stale backend reference: " + name);
  } else writeFileSync(path, normalized);
}
console.log(
  `Backend inventory: ${models.length} models, ${snapshot.tables.reduce((n, t) => n + t.columns.length, 0)} columns, ${metadata.routes.length} route records, ${commands.length} commands and ${queries.length} query projections reviewed.`,
);
