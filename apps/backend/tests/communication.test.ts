import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../server/db.ts";
import {
  organizationFixture,
  call,
  operation,
} from "./organization-fixture.ts";
after(() => db.$disconnect());
test("organization conversation scope, participation, read cursors and replay remain private across staff changes", async () => {
  const f = await organizationFixture();
  try {
    const admin = await f.person(),
trainer = await f.person(),
client = await f.person(),
foreign = await f.person(),
secondClient = await f.person(),
id = await f.create(admin);
await f.create(foreign);
const staff = await f.join(admin, id, trainer, ["trainer"]),
trainee = await f.join(admin, id, client, ["trainee"]),
second = await f.join(admin, id, secondClient, ["trainee"]);
    await call(
      admin,
      `/v1/institution`,
      operation("assign-trainer", {
        id: second.id,
        revision: 1,
        trainer: staff.id,
      }),
    );
    await call(
      admin,
      `/v1/institution`,
      operation("assign-trainer", {
        id: trainee.id,
        revision: 1,
        trainer: staff.id,
      }),
    );
    const direct = await call(
      trainer,
      `/v1/institution/communication`,
      operation("create", {
        id: randomUUID(),
        view: "trainer",
        title: "Athlete conversation",
        members: [staff.id, trainee.id],
        managers: [staff.id],
      }),
    );
    const duplicateDirect = await call(
      trainer,
      `/v1/institution/communication`,
      operation("create", {
        id: randomUUID(),
        view: "trainer",
        title: "Another title",
        members: [trainee.id, staff.id],
        managers: [staff.id],
      }),
    );
    assert.equal(direct.status, 200);
    assert.equal(duplicateDirect.status, 200);
    assert.equal(duplicateDirect.data.id, direct.data.id);
    const athleteContacts = await call(
      client,
      `/v1/institution/communication?view=trainee&contacts=true`,
    );
    assert.equal(athleteContacts.status, 200);
    assert.deepEqual(
      athleteContacts.data.members.map((p: { id: string }) => p.id),
      [staff.id],
    );
    const athleteDirect = await call(
      client,
      `/v1/institution/communication`,
      operation("create", {
        id: randomUUID(),
        view: "trainee",
        title: "My coach",
        members: [trainee.id, staff.id],
        managers: [staff.id],
      }),
    );
    assert.equal(athleteDirect.status, 200, JSON.stringify(athleteDirect));
    assert.equal(athleteDirect.data.id, direct.data.id);
    const wrongAthlete = await call(
      client,
      `/v1/institution/communication`,
      operation("create", {
        id: randomUUID(),
        view: "trainee",
        title: "Other athlete",
        members: [trainee.id, second.id],
        managers: [trainee.id],
      }),
    );
    assert.ok([400, 403].includes(wrongAthlete.status));
    const directList = await call(
      trainer,
      `/v1/institution/communication?view=trainer`,
    );
    assert.ok(directList.data.directPeople.includes(trainee.id));
    const oneAthleteGroup = randomUUID();
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/services`,
          operation("group", {
            id: oneAthleteGroup,
            view: "trainer",
            name: "Individual squad discussion",
            members: [trainee.id],
            revision: 0,
            archived: false,
          }),
        )
      ).status,
      200,
    );
    const groupPair = await call(
      trainer,
      `/v1/institution/communication`,
      operation("open-group", { id: oneAthleteGroup, view: "trainer" }),
    );
    assert.equal(groupPair.status, 200, JSON.stringify(groupPair));
    assert.notEqual(groupPair.data.id, direct.data.id);
    assert.equal(groupPair.data.private_pair, false);
    const groupPairAgain = await call(
      trainer,
      `/v1/institution/communication`,
      operation("open-group", { id: oneAthleteGroup, view: "trainer" }),
    );
    assert.equal(groupPairAgain.data.id, groupPair.data.id);
    const afterGroup = await call(
      trainer,
      `/v1/institution/communication?view=trainer`,
    );
    assert.ok(
      !afterGroup.data.groups.some(
        (group: { id: string }) => group.id === oneAthleteGroup,
      ),
    );
    const groupId = randomUUID();
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/services`,
          operation("group", {
            id: groupId,
            view: "trainer",
            name: "Tuesday squad",
            revision: 0,
            archived: false,
            members: [trainee.id, second.id],
          }),
        )
      ).status,
      200,
    );
    const groupConversation = await call(
      trainer,
      `/v1/institution/communication`,
      operation("open-group", { id: groupId, view: "trainer" }),
    );
    const repeatedGroupConversation = await call(
      trainer,
      `/v1/institution/communication`,
      operation("open-group", { id: groupId, view: "trainer" }),
    );
    assert.equal(
      groupConversation.status,
      200,
      JSON.stringify(groupConversation),
    );
    assert.equal(repeatedGroupConversation.status, 200);
    assert.equal(repeatedGroupConversation.data.id, groupConversation.data.id);
    assert.equal(
      (
        await call(
          trainer,
          `/v1/institution/communication?view=trainer&id=${groupConversation.data.id}`,
        )
      ).data.people.length,
      3,
    );
    const channel = randomUUID(),
      create = operation("create", {
        id: channel,
        view: "trainer",
        title: "Thursday training",
        members: [staff.id, trainee.id, second.id],
        managers: [staff.id],
      });
    let r = await call(trainer, `/v1/institution/communication`, create);
    assert.equal(r.status, 200, JSON.stringify(r));
    assert.deepEqual(
      (await call(trainer, `/v1/institution/communication`, create)).data,
      r.data,
    );
    const send = operation("send", {
      id: channel,
      view: "trainer",
      message: randomUUID(),
      body: "We will review the technique together.",
    });
    r = await call(trainer, `/v1/institution/communication`, send);
    assert.equal(r.status, 200, JSON.stringify(r));
    const message = r.data;
    assert.deepEqual(
      (await call(trainer, `/v1/institution/communication`, send)).data,
      message,
    );
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution/communication?view=admin&id=${channel}`,
        )
      ).status,
      403,
      "admin must explicitly join before reading",
    );
    const discovery = await call(
      admin,
      `/v1/institution/communication?view=admin&manage=true`,
    );
    assert.equal(discovery.data.items[0].last_body, null);
    assert.equal(discovery.data.items[0].unread, 0);
    const inbox = await call(
      client,
      `/v1/institution/communication?view=trainee`,
    );
    assert.equal(inbox.data.items[0].unread, 1);
    assert.equal(
      (
        await call(
          client,
          `/v1/institution/communication`,
          operation("read", {
            id: channel,
            view: "trainee",
            sequence: message.sequence,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(client, `/v1/institution/communication?view=trainee`)).data
        .items[0].unread,
      0,
    );
    assert.equal(
      (
        await call(
          foreign,
          `/v1/institution/communication?view=admin&id=${channel}`,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          client,
          `/v1/institution/communication`,
          operation("archive", {
            id: channel,
            view: "trainee",
            revision: 1,
            archived: true,
          }),
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution/communication`,
          operation("join", { id: channel, view: "admin" }),
        )
      ).status,
      200,
    );
    const joined = await call(
      admin,
      `/v1/institution/communication?view=admin&id=${channel}`,
    );
    assert.equal(joined.data.people.length, 4);
    assert.equal(joined.data.messages.length, 1);
    const me = joined.data.self;
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution/communication`,
          operation("members", {
            id: channel,
            view: "admin",
            revision: 1,
            members: [me, trainee.id],
            managers: [me],
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (await call(trainer, `/v1/institution/communication`, send)).status,
      403,
      "removed sender cannot replay or read",
    );
    assert.equal(
      (
        await call(
          admin,
          `/v1/institution/communication`,
          operation("archive", {
            id: channel,
            view: "admin",
            revision: 2,
            archived: true,
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await call(
          client,
          `/v1/institution/communication`,
          operation("send", {
            id: channel,
            view: "trainee",
            message: randomUUID(),
            body: "not allowed",
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          client,
          `/v1/institution/communication?view=trainee&id=${channel}`,
        )
      ).data.messages.length,
      1,
    );
    await call(
      admin,
      `/v1/institution`,
      operation("member", {
        id: trainee.id,
        revision: 2,
        roles: ["trainee"],
        active: false,
      }),
    );
    assert.equal(
      (
        await call(
          client,
          `/v1/institution/communication?view=trainee&id=${channel}`,
        )
      ).status,
      403,
    );
  } finally {
    await f.cleanup();
  }
});
