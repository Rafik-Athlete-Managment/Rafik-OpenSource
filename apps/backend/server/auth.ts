import {
  randomBytes,
  randomUUID,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  db,
  local,
  ApiError,
  ensureProfileInTransaction,
  type Actor,
} from "./db.ts";
import { acceptInvitationSignup } from "./institution.ts";
import { strongPassword } from "@rafik/shared/password";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const actor = (u: {
  id: string;
  email: string | null;
  raw_user_meta_data: unknown;
}): Actor => ({
  id: u.id,
  email: u.email,
  user_metadata: u.raw_user_meta_data as Record<string, unknown>,
});
function derive(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key as Buffer)),
    );
  });
}
export function validatePassword(value: unknown) {
  if (!strongPassword(value)) throw new ApiError(400, "password_length");
  return value;
}
function validateLoginPassword(value: unknown) {
  if (typeof value !== "string" || value.length < 1 || value.length > 128)
    throw new ApiError(400, "password_length");
  return value;
}
export async function passwordHash(password: string) {
  const salt = randomBytes(16),
    key = await derive(password, salt);
  return `scrypt$32768$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}
const dummyPasswordHash = passwordHash(randomBytes(32).toString("hex"));
async function verifyPassword(password: string, encoded: string | null) {
  if (!encoded) return false;
  const [kind, n, r, p, saltHex, expectedHex] = encoded.split("$");
  if (
    kind !== "scrypt" ||
    n !== "32768" ||
    r !== "8" ||
    p !== "1" ||
    !/^[a-f0-9]{32}$/.test(saltHex || "") ||
    !/^[a-f0-9]{128}$/.test(expectedHex || "")
  )
    return false;
  const expected = Buffer.from(expectedHex, "hex"),
    actual = await derive(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actual, expected);
}
function emailOf(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  )
    throw new ApiError(400, "invalid_email");
  return value.trim().toLowerCase();
}
function nameOf(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 80)
    throw new ApiError(400, "invalid_name");
  return value.trim();
}
function institutionName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100)
    throw new ApiError(400, "invalid_institution_name");
  return value.trim();
}
export async function identify(req: IncomingMessage): Promise<Actor | null> {
  if (req.headers["x-rafik-client"] === "android") {
    const token = req.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!token) return null;
    const session = await db.mobile_sessions.findUnique({
      where: { access_token_hash: hash(token) },
      include: { users: true },
    });
    if (
      !session ||
      session.revoked_at ||
      session.access_expires_at <= new Date() ||
      session.expires_at <= new Date() ||
      session.absolute_expires_at <= new Date()
    )
      return null;
    const blocked = await db.platform_identity_state.findUnique({
      where: { user_id: session.user_id },
    });
    return blocked?.suspended ? null : actor(session.users);
  }
  const token = req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith("rafik_session="))
    ?.slice(14);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = await db.identity_sessions.findUnique({
    where: { token_hash: hash(token) },
    include: { users: true },
  });
  const blocked =
    session &&
    (await db.platform_identity_state.findUnique({
      where: { user_id: session.user_id },
    }));
  return session && !blocked?.suspended && session.expires_at > new Date()
    ? actor(session.users)
    : null;
}
async function session(res: ServerResponse, user: Actor) {
  if (
    (
      await db.platform_identity_state.findUnique({
        where: { user_id: user.id },
      })
    )?.suspended
  )
    throw new ApiError(403, "account_suspended");
  const token = randomBytes(32).toString("hex"),
    expires = new Date(Date.now() + 7 * 86400000);
  await db.identity_sessions.create({
    data: { token_hash: hash(token), user_id: user.id, expires_at: expires },
  });
  res.setHeader(
    "Set-Cookie",
    `rafik_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${local ? "" : "; Secure"}`,
  );
  return { user };
}
async function rateLimit(key: string, limit: number, seconds: number) {
  const rows = await db.$queryRaw<
    { count: number }[]
  >`INSERT INTO identity.rate_limits(key,count,window_start) VALUES(${hash(key)},1,now()) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN identity.rate_limits.window_start<now()-make_interval(secs=>${seconds}) THEN 1 ELSE identity.rate_limits.count+1 END,window_start=CASE WHEN identity.rate_limits.window_start<now()-make_interval(secs=>${seconds}) THEN now() ELSE identity.rate_limits.window_start END RETURNING count`;
  if (rows[0].count > limit) throw new ApiError(429, "rate_limited");
}
const mobileToken = () => randomBytes(32).toString("hex");
const mobileTokenHash = (value: string) => hash(value);
const bearerToken = (req: IncomingMessage) =>
  req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1] || null;
const mobileDeviceName = (value: unknown) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 80)
    : "Android device";
async function createMobileSession(user: Actor, deviceName: string) {
  const blocked = await db.platform_identity_state.findUnique({
    where: { user_id: user.id },
  });
  if (blocked?.suspended) throw new ApiError(403, "account_suspended");
  const now = new Date(),
    access = mobileToken(),
    refresh = mobileToken(),
    accessExpires = new Date(now.getTime() + 15 * 60_000),
    absoluteExpires = new Date(now.getTime() + 90 * 86400_000),
    refreshExpires = new Date(now.getTime() + 30 * 86400_000);
  await db.mobile_sessions.create({
    data: {
      id: randomUUID(),
      user_id: user.id,
      access_token_hash: mobileTokenHash(access),
      refresh_token_hash: mobileTokenHash(refresh),
      access_expires_at: accessExpires,
      expires_at: refreshExpires,
      absolute_expires_at: absoluteExpires,
      device_name: deviceName,
    },
  });
  return {
    user,
    access_token: access,
    access_expires_at: accessExpires.toISOString(),
    refresh_token: refresh,
    refresh_expires_at: refreshExpires.toISOString(),
  };
}
function remoteKey(req: IncomingMessage) {
  const forwarded =
    process.env.RAFIK_TRUST_PROXY === "true"
      ? req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
      : null;
  return forwarded || req.socket.remoteAddress || "unknown";
}
async function setupStatus() {
  const institutions = await db.institutions.count({
    where: { kind: "organization" },
  });
  return { initialized: institutions > 0 };
}
async function initialSetup(
  body: Record<string, unknown>,
  req: IncomingMessage,
  res: ServerResponse,
) {
  await rateLimit(`setup:${remoteKey(req)}`, 10, 600);
  const email = emailOf(body.email),
    name = nameOf(body.name),
    institutionLabel = institutionName(body.institution),
    password = validatePassword(body.password),
    encoded = await passwordHash(password);
  const user = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(1179406164,3)::text`;
    if ((await tx.institutions.count({ where: { kind: "organization" } })) > 0)
      throw new ApiError(409, "setup_already_complete");
    const created = await tx.users.create({
      data: {
        email,
        password_hash: encoded,
        raw_user_meta_data: { display_name: name },
      },
    });
    await ensureProfileInTransaction(tx, actor(created), name);
    const institution = await tx.institutions.create({
      data: {
        id: randomUUID(),
        kind: "organization",
        name: institutionLabel,
        created_by: created.id,
      },
    });
    await tx.institution_members.create({
      data: {
        id: randomUUID(),
        institution_id: institution.id,
        user_id: created.id,
        roles: ["admin"],
        name,
      },
    });
    await tx.institution_audit_events.create({
      data: {
        institution_id: institution.id,
        actor_id: created.id,
        kind: "organization_created",
        detail: { name: institutionLabel, setup: true },
      },
    });
    await tx.$queryRaw`SELECT public.claim_instance_branding(${created.id}::uuid)`;
    return created;
  });
  return session(res, actor(user));
}
export async function authRoute(
  path: string,
  body: Record<string, unknown>,
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (path === "session") return { user: await identify(req) };
  if (path === "setup-status") return setupStatus();
  if (path === "setup") return initialSetup(body, req, res);
  if (path === "logout") {
    const token = req.headers.cookie
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("rafik_session="))
      ?.slice(14);
    if (token)
      await db.identity_sessions.deleteMany({
        where: { token_hash: hash(token) },
      });
    res.setHeader(
      "Set-Cookie",
      `rafik_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${local ? "" : "; Secure"}`,
    );
    return { user: null };
  }
  if (path === "password-login") {
    const email = emailOf(body.email),
      password = validateLoginPassword(body.password),
      remote = remoteKey(req);
    await rateLimit(`login:ip:${remote}`, 50, 600);
    await rateLimit(`login:account:${email}`, 10, 600);
    const user = await db.users.findUnique({ where: { email } });
    if (
      !(await verifyPassword(
        password,
        user?.password_hash || (await dummyPasswordHash),
      ))
    )
      throw new ApiError(401, "invalid_credentials");
    return session(res, actor(user!));
  }
  if (path === "accept-invitation") {
    await rateLimit(`invite:${remoteKey(req)}`, 40, 600);
    const token = body.token;
    if (typeof token !== "string") throw new ApiError(400, "invalid_request");
    const email = emailOf(body.email),
      name = nameOf(body.name),
      password = validatePassword(body.password),
      encoded = await passwordHash(password),
      accepted = await acceptInvitationSignup(token, email, name, encoded);
    return {
      ...(await session(res, actor(accepted.user))),
      institution_id: accepted.institution_id,
      role: ["admin", "trainer", "trainee"].find((r) =>
        accepted.roles.includes(r),
      ),
    };
  }
  if (path === "complete-password-setup") {
    await rateLimit(`password-setup:${remoteKey(req)}`, 20, 600);
    if (typeof body.token !== "string" || !/^[a-f0-9]{64}$/.test(body.token))
      throw new ApiError(400, "invalid_request");
    const encoded = await passwordHash(validatePassword(body.password));
    const user = await db.$transaction(async (tx) => {
      const links = await tx.$queryRaw<
        {
          token_hash: string;
          user_id: string;
          institution_id: string;
          created_by: string;
          expires_at: Date;
        }[]
      >`SELECT token_hash,user_id,institution_id,created_by,expires_at FROM identity.password_setup_tokens WHERE token_hash=${hash(body.token as string)} FOR UPDATE`;
      const link = links[0];
      if (!link || link.expires_at <= new Date())
        throw new ApiError(404, "password_setup_unavailable");
      const [member, creator, institution, account] = await Promise.all([
        tx.institution_members.findFirst({
          where: {
            institution_id: link.institution_id,
            user_id: link.user_id,
            active: true,
          },
        }),
        tx.institution_members.findFirst({
          where: {
            institution_id: link.institution_id,
            user_id: link.created_by,
            active: true,
            roles: { has: "admin" },
          },
        }),
        tx.institutions.findUnique({ where: { id: link.institution_id } }),
        tx.users.findUnique({ where: { id: link.user_id } }),
      ]);
      if (
        !member ||
        !creator ||
        !institution ||
        institution.archived ||
        !account
      )
        throw new ApiError(404, "password_setup_unavailable");
      await tx.users.update({
        where: { id: account.id },
        data: { password_hash: encoded },
      });
      await tx.password_setup_tokens.deleteMany({
        where: { user_id: account.id },
      });
      await tx.identity_sessions.deleteMany({ where: { user_id: account.id } });
      await tx.mobile_sessions.updateMany({
        where: { user_id: account.id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      return account;
    });
    return session(res, actor(user));
  }
  if (path === "local-preview") {
    const email = emailOf(body.email);
    if (
      !local ||
      ![
        "coach",
        "client",
        "coach2",
        "other",
        "orgadmin",
        "orgtrainer",
        "orgtrainee",
        "orgadmin2",
        "operator",
      ].some((n) => email === `${n}@rafik.test`)
    )
      throw new ApiError(403, "forbidden");
    const u = await db.users.findUnique({ where: { email } });
    if (!u) throw new ApiError(404, "preview_unavailable");
    return session(res, actor(u));
  }
  throw new ApiError(404, "not_found");
}

export async function mobileAuthRoute(
  path: string,
  body: Record<string, unknown>,
  req: IncomingMessage,
) {
  if (req.headers["x-rafik-client"] !== "android")
    throw new ApiError(403, "client_header_required");
  if (path === "session") {
    const user = await identify(req);
    if (!user) throw new ApiError(401, "unauthenticated");
    return { user };
  }
  if (path === "login") {
    const email = emailOf(body.email),
      password = validateLoginPassword(body.password),
      remote = remoteKey(req);
    await rateLimit(`mobile-login:ip:${remote}`, 50, 600);
    await rateLimit(`mobile-login:account:${email}`, 10, 600);
    const user = await db.users.findUnique({ where: { email } });
    if (
      !(await verifyPassword(
        password,
        user?.password_hash || (await dummyPasswordHash),
      ))
    )
      throw new ApiError(401, "invalid_credentials");
    return createMobileSession(
      actor(user!),
      mobileDeviceName(body.device_name),
    );
  }
  if (path === "refresh") {
    const refresh = body.refresh_token;
    if (typeof refresh !== "string" || !/^[a-f0-9]{64}$/.test(refresh))
      throw new ApiError(401, "invalid_mobile_session");
    await rateLimit(`mobile-refresh:ip:${remoteKey(req)}`, 120, 600);
    const incomingHash = mobileTokenHash(refresh),
      now = new Date();
    const result = await db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          id: string;
          user_id: string;
          refresh_token_hash: string;
          previous_refresh_token_hash: string | null;
          absolute_expires_at: Date;
          expires_at: Date;
          revoked_at: Date | null;
        }[]
      >`SELECT id,user_id,refresh_token_hash,previous_refresh_token_hash,absolute_expires_at,expires_at,revoked_at FROM identity.mobile_sessions WHERE refresh_token_hash=${incomingHash} OR previous_refresh_token_hash=${incomingHash} FOR UPDATE`;
      const session = rows[0];
      if (!session || session.revoked_at) return null;
      if (
        session.previous_refresh_token_hash === incomingHash ||
        session.expires_at <= now ||
        session.absolute_expires_at <= now
      ) {
        await tx.mobile_sessions.update({
          where: { id: session.id },
          data: { revoked_at: now },
        });
        return null;
      }
      const blocked = await tx.platform_identity_state.findUnique({
        where: { user_id: session.user_id },
      });
      if (blocked?.suspended) {
        await tx.mobile_sessions.update({
          where: { id: session.id },
          data: { revoked_at: now },
        });
        return null;
      }
      const user = await tx.users.findUnique({
        where: { id: session.user_id },
      });
      if (!user) return null;
      const access = mobileToken(),
        nextRefresh = mobileToken(),
        accessExpires = new Date(now.getTime() + 15 * 60_000),
        refreshExpires = new Date(
          Math.min(
            now.getTime() + 30 * 86400_000,
            session.absolute_expires_at.getTime(),
          ),
        );
      await tx.mobile_sessions.update({
        where: { id: session.id },
        data: {
          access_token_hash: mobileTokenHash(access),
          previous_refresh_token_hash: session.refresh_token_hash,
          refresh_token_hash: mobileTokenHash(nextRefresh),
          access_expires_at: accessExpires,
          expires_at: refreshExpires,
          last_seen_at: now,
        },
      });
      return {
        user: actor(user),
        access_token: access,
        access_expires_at: accessExpires.toISOString(),
        refresh_token: nextRefresh,
        refresh_expires_at: refreshExpires.toISOString(),
      };
    });
    if (!result) throw new ApiError(401, "invalid_mobile_session");
    return result;
  }
  if (path === "logout") {
    const access = bearerToken(req),
      refresh = body.refresh_token;
    const tokenHashes = [
      ...(access ? [{ access_token_hash: mobileTokenHash(access) }] : []),
      ...(typeof refresh === "string" && /^[a-f0-9]{64}$/.test(refresh)
        ? [
            { refresh_token_hash: mobileTokenHash(refresh) },
            { previous_refresh_token_hash: mobileTokenHash(refresh) },
          ]
        : []),
    ];
    if (tokenHashes.length)
      await db.mobile_sessions.updateMany({
        where: { OR: tokenHashes },
        data: { revoked_at: new Date() },
      });
    return { user: null };
  }
  throw new ApiError(404, "not_found");
}
