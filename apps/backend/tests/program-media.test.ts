import { apiOrigin } from "./test-target.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { db } from "../server/db.ts";
import {
  organizationFixture,
  call,
  operation,
  type Person,
} from "./organization-fixture.ts";
after(() => db.$disconnect());
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=",
  "base64",
);
async function media(
  p: Person,
  id: string,
  institution?: string,
  bytes = png,
  type = "image/png",
) {
  return fetch(
    `${apiOrigin}/v1/program-media/${id}${institution ? "?institution=" + institution : ""}`,
    {
      method: institution ? "PUT" : "GET",
      headers: {
        Cookie: p.cookie,
        "x-rafik-client": "web",
        "Content-Type": type,
      },
      body: institution ? bytes : undefined,
    },
  );
}
test("private program imagery has immutable bytes, institution publication and revoked audience checks", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
client = await f.person(),
outsider = await f.person(),
id = await f.create(admin);
await f.create(outsider);
const member = await f.join(admin, id, client, ["trainee"]),
image = randomUUID();
    assert.equal((await media(admin, image, id)).status, 200);
    assert.equal((await media(admin, image, id)).status, 200);
    assert.equal(
      (
        await media(
          admin,
          image,
          id,
          Buffer.concat([png, Buffer.from("changed")]),
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await media(
          admin,
          randomUUID(),
          id,
          Buffer.from("<svg/>"),
          "image/svg+xml",
        )
      ).status,
      400,
    );
    assert.equal((await media(outsider, image)).status, 403);
    assert.equal((await media(client, image)).status, 403);
    const draft = JSON.parse(
      await readFile(
        new URL("../content/starter.json", import.meta.url),
        "utf8",
      ),
    ).prescription;
    draft.presentation = {
      goal: "Learn consistent movement",
      level: "beginner",
      cover: image,
    };
    const program = randomUUID(),
      publish = operation("publish", {
        view: "admin",
        id: program,
        title: "Foundation with cover",
        draft,
        revision: null,
      });
    let r = await call(admin, `/v1/institution/programs`, publish);
    assert.equal(r.status, 200, JSON.stringify(r));
    const foreign = await call(outsider, `/v1/institution/programs`, {
      ...publish,
      operation: randomUUID(),
      id: randomUUID(),
    });
    assert.equal(foreign.status, 403);
    const downloaded = await media(client, image);
    assert.equal(downloaded.status, 200);
    assert.ok(Buffer.from(await downloaded.arrayBuffer()).equals(png));
    assert.equal(downloaded.headers.get("cache-control"), "no-store");
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution`,
          operation("member", {
            id: member.id,
            revision: 1,
            roles: ["trainee"],
            active: false,
          }),
        )
      ).status,
      200,
    );
    assert.equal((await media(client, image)).status, 403);
    const exported = await call(client, "/v1/account/institution");
    assert.equal(exported.status, 200);
    assert.equal(exported.data.memberships.length, 1);
    assert.equal(exported.data.sessions.length, 0);
  } finally {
    await f.cleanup();
  }
});
