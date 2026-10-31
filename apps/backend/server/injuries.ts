import { createHash, randomUUID } from "node:crypto";
import { ApiError, type Actor } from "./db.ts";
import { calendarDate } from "./service-definitions.ts";
import { role } from "./programming.ts";
import { event, scoped, uuid, type Role, type Tx } from "./institution.ts";

const POLICY_VERSION = "injury-status-v1-2026-10";
type Injury = {
  id: string;
  institution_id: string;
  athlete_member_id: string;
  participation: "modified" | "unavailable";
  effective_from: Date;
  state: "active" | "closed";
  revision: number;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
};
type Consent = {
  age_group: "adult" | "minor";
  guardian_authorized: boolean;
  athlete_assented_at: Date | null;
  assent_policy_version: string | null;
  withdrawn_at: Date | null;
  revision: number;
};
const iso = (date: Date) => date.toISOString().slice(0, 10);

function requireView(value: string | null): Role {
  const view = role(value);
  if (!view) throw new ApiError(403, "forbidden");
  return view;
}

async function consent(tx: Tx, institution: string, member: string) {
  return (
    (
      await tx.$queryRaw<Consent[]>`
      SELECT age_group,guardian_authorized,athlete_assented_at,assent_policy_version,withdrawn_at,revision
      FROM public.institution_injury_permissions
      WHERE institution_id=${institution}::uuid AND athlete_member_id=${member}::uuid
    `
    )[0] || null
  );
}

async function appendHistory(
  tx: Tx,
  actor: Actor,
  record: Injury,
  action: "reported" | "corrected" | "closed" | "withdrawn",
) {
  await tx.$executeRaw`
    INSERT INTO public.institution_injury_history(id,institution_id,record_id,revision,action,participation,effective_from,recorded_by)
    VALUES(${randomUUID()}::uuid,${record.institution_id}::uuid,${record.id}::uuid,${record.revision},${action},${record.participation},${record.effective_from}::date,${actor.id}::uuid)
  `;
  await tx.$executeRaw`
    INSERT INTO public.institution_injury_access_log(id,institution_id,record_id,athlete_member_id,actor_id,action)
    VALUES(${randomUUID()}::uuid,${record.institution_id}::uuid,${record.id}::uuid,${record.athlete_member_id}::uuid,${actor.id}::uuid,${action})
  `;
}

export async function injuries(
  actor: Actor,
  institution: string,
  q: URLSearchParams,
) {
  const view = requireView(q.get("view"));
  if (view === "admin") {
    return scoped(actor, institution, ["admin"], async (tx) => {
      const rows = await tx.$queryRaw<
        {
          member_id: string;
          name: string;
          age_group: string | null;
          guardian_authorized: boolean | null;
          athlete_assented_at: Date | null;
          withdrawn_at: Date | null;
          revision: number | null;
        }[]
      >`
        SELECT m.id member_id,m.name,p.age_group,p.guardian_authorized,p.athlete_assented_at,p.withdrawn_at,p.revision
        FROM public.institution_members m
        LEFT JOIN public.institution_injury_permissions p ON p.institution_id=m.institution_id AND p.athlete_member_id=m.id
        WHERE m.institution_id=${institution}::uuid AND m.active AND 'trainee'=ANY(m.roles)
        ORDER BY m.name,m.id
      `;
      return {
        view,
        policy_version: POLICY_VERSION,
        members: rows.map((row) => ({
          ...row,
          ready:
            row.age_group === "adult" ||
            (row.age_group === "minor" && row.guardian_authorized === true),
        })),
      };
    });
  }
  if (view === "trainee") {
    return scoped(actor, institution, ["trainee"], async (tx, self) => {
      const exporting = q.get("export") === "true";
      const policy = await consent(tx, institution, self.id);
      const rows = await tx.$queryRaw<Injury[]>`
        SELECT * FROM public.institution_injury_records
        WHERE institution_id=${institution}::uuid AND athlete_member_id=${self.id}::uuid
        ORDER BY created_at DESC,id
      `;
      for (const record of rows)
        await tx.$executeRaw`
          INSERT INTO public.institution_injury_access_log(id,institution_id,record_id,athlete_member_id,actor_id,action)
          VALUES(${randomUUID()}::uuid,${institution}::uuid,${record.id}::uuid,${self.id}::uuid,${actor.id}::uuid,${exporting ? "athlete_export" : "athlete_detail_read"})
        `;
      const history = rows.length
        ? await tx.$queryRaw<
            {
              record_id: string;
              revision: number;
              action: string;
              participation: string;
              effective_from: Date;
              recorded_by: string;
              recorded_at: Date;
            }[]
          >`
            SELECT record_id,revision,action,participation,effective_from,recorded_by,recorded_at
            FROM public.institution_injury_history
            WHERE institution_id=${institution}::uuid AND record_id=ANY(${rows.map((r) => r.id)}::uuid[])
            ORDER BY record_id,revision DESC
          `
        : [];
      return {
        view,
        policy_version: POLICY_VERSION,
        consent: policy,
        items: rows.map((record) => ({
          ...record,
          effective_from: iso(record.effective_from),
          history: history
            .filter((entry) => entry.record_id === record.id)
            .map((entry) => ({
              ...entry,
              effective_from: iso(entry.effective_from),
            })),
        })),
      };
    });
  }
  return scoped(actor, institution, ["trainer"], async (tx, self) => {
    const rows = await tx.$queryRaw<(Injury & { athlete_name: string })[]>`
      SELECT r.id,r.institution_id,r.athlete_member_id,r.participation,r.effective_from,r.state,r.revision,r.created_at,r.updated_at,r.closed_at,m.name athlete_name
      FROM public.institution_injury_records r
      JOIN public.institution_members m ON m.institution_id=r.institution_id AND m.id=r.athlete_member_id
      JOIN public.institution_injury_permissions p ON p.institution_id=r.institution_id AND p.athlete_member_id=r.athlete_member_id
      WHERE r.institution_id=${institution}::uuid AND r.state='active' AND m.active AND m.trainer_id=${self.id}::uuid
        AND p.athlete_assented_at IS NOT NULL AND p.withdrawn_at IS NULL
        AND (p.age_group='adult' OR (p.age_group='minor' AND p.guardian_authorized))
      ORDER BY m.name,m.id
    `;
    for (const record of rows)
      await tx.$executeRaw`
        INSERT INTO public.institution_injury_access_log(id,institution_id,record_id,athlete_member_id,actor_id,action)
        VALUES(${randomUUID()}::uuid,${institution}::uuid,${record.id}::uuid,${record.athlete_member_id}::uuid,${actor.id}::uuid,'coach_status_read')
      `;
    return {
      view,
      items: rows.map((record) => ({
        id: record.id,
        athlete_member_id: record.athlete_member_id,
        athlete_name: record.athlete_name,
        participation: record.participation,
        effective_from: iso(record.effective_from),
      })),
    };
  });
}

export async function injuryCommand(
  actor: Actor,
  institution: string,
  input: Record<string, unknown>,
) {
  const view = requireView(typeof input.view === "string" ? input.view : null);
  const action = String(input.action || "");
  if (
    !new Set([
      "configure",
      "assent",
      "withdraw",
      "report",
      "correct",
      "close",
    ]).has(action)
  )
    throw new ApiError(400, "invalid_request");
  if (
    (action === "configure" && view !== "admin") ||
    (action !== "configure" && view !== "trainee")
  )
    throw new ApiError(403, "forbidden");

  return scoped(actor, institution, [view], async (tx, self) => {
    if (action === "configure") {
      const member = uuid(input.member_id),
        ageGroup = String(input.age_group),
        guardian = input.guardian_authorized === true;
      if (
        !new Set(["adult", "minor"]).has(ageGroup) ||
        (ageGroup === "minor" && !guardian) ||
        (ageGroup === "adult" && guardian)
      )
        throw new ApiError(400, "invalid_consent");
      const athlete = (
        await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM public.institution_members WHERE institution_id=${institution}::uuid AND id=${member}::uuid AND active AND 'trainee'=ANY(roles)
        `
      )[0];
      if (!athlete) throw new ApiError(404, "athlete_unavailable");
      const existing = await consent(tx, institution, member),
        expected = Number(input.revision || 0);
      if ((existing?.revision || 0) !== expected)
        throw new ApiError(409, "conflict");
      if (existing)
        await tx.$executeRaw`
          UPDATE public.institution_injury_permissions
          SET age_group=${ageGroup},guardian_authorized=${guardian},guardian_verified_by=${ageGroup === "minor" ? actor.id : null}::uuid,
              guardian_verified_at=${ageGroup === "minor" ? new Date() : null}::timestamptz,
              athlete_assented_at=NULL,assent_policy_version=NULL,withdrawn_at=NULL,revision=revision+1,configured_at=now(),configured_by=${actor.id}::uuid
          WHERE institution_id=${institution}::uuid AND athlete_member_id=${member}::uuid
        `;
      else
        await tx.$executeRaw`
          INSERT INTO public.institution_injury_permissions(institution_id,athlete_member_id,age_group,guardian_authorized,guardian_verified_by,guardian_verified_at,configured_by)
          VALUES(${institution}::uuid,${member}::uuid,${ageGroup},${guardian},${ageGroup === "minor" ? actor.id : null}::uuid,${ageGroup === "minor" ? new Date() : null}::timestamptz,${actor.id}::uuid)
        `;
      await event(tx, actor, institution, "injury_consent_configured", member);
      return { member_id: member, revision: (existing?.revision || 0) + 1 };
    }

    if (action === "assent") {
      const policy = await consent(tx, institution, self.id);
      if (
        !policy ||
        (policy.age_group === "minor" && !policy.guardian_authorized)
      )
        throw new ApiError(409, "consent_setup_required");
      await tx.$executeRaw`
        UPDATE public.institution_injury_permissions
        SET athlete_assented_at=now(),assent_policy_version=${POLICY_VERSION},withdrawn_at=NULL,revision=revision+1
        WHERE institution_id=${institution}::uuid AND athlete_member_id=${self.id}::uuid
      `;
      await event(tx, actor, institution, "injury_athlete_assented", self.id);
      return { assented: true, policy_version: POLICY_VERSION };
    }

    if (action === "withdraw") {
      const policy = await consent(tx, institution, self.id);
      if (!policy) throw new ApiError(409, "consent_setup_required");
      await tx.$executeRaw`
        UPDATE public.institution_injury_permissions SET withdrawn_at=now(),revision=revision+1
        WHERE institution_id=${institution}::uuid AND athlete_member_id=${self.id}::uuid
      `;
      const active = await tx.$queryRaw<Injury[]>`
        UPDATE public.institution_injury_records SET state='closed',closed_at=now(),revision=revision+1,updated_at=now()
        WHERE institution_id=${institution}::uuid AND athlete_member_id=${self.id}::uuid AND state='active'
        RETURNING *
      `;
      for (const record of active)
        await appendHistory(tx, actor, record, "withdrawn");
      await event(tx, actor, institution, "injury_consent_withdrawn", self.id);
      return { withdrawn: true, closed: active.length };
    }

    const operation = uuid(input.operation),
      id = action === "report" ? uuid(input.id) : uuid(input.id),
      participation = String(input.participation || ""),
      effective = calendarDate(input.effective_from),
      requestHash = createHash("sha256")
        .update(
          JSON.stringify([
            action,
            id,
            participation,
            effective,
            Number(input.revision || 0),
          ]),
        )
        .digest("hex");
    if (!new Set(["modified", "unavailable"]).has(participation))
      throw new ApiError(400, "invalid_request");
    const permission = await consent(tx, institution, self.id);
    if (
      !permission ||
      !permission.athlete_assented_at ||
      permission.withdrawn_at
    )
      throw new ApiError(403, "consent_required");
    if (permission.age_group === "minor" && !permission.guardian_authorized)
      throw new ApiError(403, "guardian_authorization_required");
    const receipt = (
      await tx.$queryRaw<
        {
          actor_id: string;
          request_hash: string;
          record_id: string;
          result_revision: number;
        }[]
      >`
        SELECT actor_id,request_hash,record_id,result_revision FROM public.institution_injury_operations WHERE institution_id=${institution}::uuid AND operation_id=${operation}::uuid
      `
    )[0];
    if (receipt) {
      if (receipt.actor_id !== actor.id || receipt.request_hash !== requestHash)
        throw new ApiError(409, "operation_reused");
      return {
        id: receipt.record_id,
        revision: receipt.result_revision,
        replayed: true,
      };
    }

    let record: Injury;
    if (action === "report") {
      if (Number(input.revision || 0) !== 0)
        throw new ApiError(409, "conflict");
      const rows = await tx.$queryRaw<Injury[]>`
        INSERT INTO public.institution_injury_records(id,institution_id,athlete_member_id,participation,effective_from)
        VALUES(${id}::uuid,${institution}::uuid,${self.id}::uuid,${participation},${effective}::date)
        RETURNING *
      `;
      record = rows[0];
      await appendHistory(tx, actor, record, "reported");
    } else {
      const found = (
        await tx.$queryRaw<Injury[]>`
          SELECT * FROM public.institution_injury_records WHERE institution_id=${institution}::uuid AND id=${id}::uuid AND athlete_member_id=${self.id}::uuid
          FOR UPDATE
        `
      )[0];
      if (!found || found.state !== "active")
        throw new ApiError(404, "injury_unavailable");
      if (found.revision !== Number(input.revision))
        throw new ApiError(409, "conflict");
      const rows =
        action === "close"
          ? await tx.$queryRaw<Injury[]>`
            UPDATE public.institution_injury_records SET state='closed',closed_at=now(),revision=revision+1,updated_at=now()
            WHERE institution_id=${institution}::uuid AND id=${id}::uuid RETURNING *
          `
          : action === "correct"
            ? await tx.$queryRaw<Injury[]>`
              UPDATE public.institution_injury_records SET participation=${participation},effective_from=${effective}::date,revision=revision+1,updated_at=now()
              WHERE institution_id=${institution}::uuid AND id=${id}::uuid RETURNING *
            `
            : (() => {
                throw new ApiError(400, "invalid_request");
              })();
      record = rows[0];
      await appendHistory(
        tx,
        actor,
        record,
        action === "close" ? "closed" : "corrected",
      );
    }
    await tx.$executeRaw`
      INSERT INTO public.institution_injury_operations(institution_id,operation_id,actor_id,request_hash,record_id,result_revision)
      VALUES(${institution}::uuid,${operation}::uuid,${actor.id}::uuid,${requestHash},${record.id}::uuid,${record.revision})
    `;
    return { id: record.id, revision: record.revision, replayed: false };
  });
}
