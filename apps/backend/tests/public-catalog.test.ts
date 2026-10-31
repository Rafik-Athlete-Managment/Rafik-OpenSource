import { apiOrigin } from "./test-target.ts";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  foodCatalog,
  exerciseDatasetCatalog,
  wgerExerciseCatalog,
  exerciseMediaCatalog,
  exerciseMediaAsset,
} from "../server/public-catalog.ts";
import { db } from "../server/db.ts";
after(() => db.$disconnect());
test("curated nutrition preserves source energy, macro units, portions and provenance", async () => {
  const data = await foodCatalog();
  assert.equal(data.schema, 1);
  assert.equal(data.foods.length, 15);
  assert.equal(new Set(data.foods.map((f: { id: string }) => f.id)).size, 15);
  for (const f of data.foods) {
    assert.equal(f.basis, 100);
    assert.equal(f.unit, "g");
    assert.match(f.sourceUrl, /^https:\/\/fdc.nal.usda.gov\//);
    assert.ok(f.originalDescription && f.name_ar);
    for (const k of ["kcal", "protein_g", "carb_g", "fat_g"])
      assert.ok(Number.isFinite(f.nutrients[k]) && f.nutrients[k] >= 0);
    for (const p of f.portions) {
      assert.match(p.name_ar, /[\u0600-\u06ff]/);
      assert.ok(
        p.grams > 0 &&
          f.sourcePortions.some(
            (s: { gramWeight: number }) => s.gramWeight === p.grams,
          ),
      );
    }
  }
  assert.equal(
    data.foods.find((f: { fdcId: number }) => f.fdcId === 171413).nutrients
      .kcal,
    884,
  );
  const response = await fetch(apiOrigin + "/v1/catalog/foods");
  assert.equal(response.status, 200);
  assert.equal((await response.json()).version, data.version);
});
test("shared exercise dataset keeps its pinned MIT provenance, usable filter facets and no source media", async () => {
  const data = await exerciseDatasetCatalog();
  assert.equal(data.schema, 1);
  assert.equal(data.source.repository, "hasaneyldrm/exercises-dataset");
  assert.equal(data.source.commit, "7455efae41b330c265e7cd4b78dfa848e7ce5ebd");
  assert.equal(data.source.license, "MIT");
  assert.equal(data.source.rawRecordCount, 1324);
  assert.equal(data.exercises.length, 1324);
  assert.equal(
    data.recordsSha256,
    "0527c31566a056b6405f0c25c10ca6dbc330885bcf2dba8947760a350754ae62",
  );
  assert.equal(
    new Set(data.exercises.map((e: { id: string }) => e.id)).size,
    1324,
  );
  assert.deepEqual(data.exercises[0], {
    id: "dataset-0001",
    sourceId: "0001",
    name: "3/4 sit-up",
    nameAr: null,
    category: "waist",
    categoryAr: "الخصر",
    bodyPart: "waist",
    targetMuscle: "abs",
    equipment: "Bodyweight",
    equipmentKey: "body weight",
    equipmentAr: "وزن الجسم",
    instructions: data.exercises[0].instructions,
    instructionsAr: null,
    movement: "waist",
    kind: "strength",
  });
  assert.match(data.exercises[0].instructions, /Lie flat on your back/);
  assert.ok(
    data.exercises.some(
      (e: { id: string; kind: string }) =>
        e.id === "dataset-3220" && e.kind === "timed",
    ),
  );
  assert.ok(
    data.exercises.some(
      (e: { id: string; kind: string }) =>
        e.id === "dataset-1512" && e.kind === "timed",
    ),
  );
  assert.ok(
    data.exercises.some(
      (e: { id: string; kind: string }) =>
        e.id === "dataset-2135" && e.kind === "timed",
    ),
  );
  assert.ok(
    data.exercises.some(
      (e: { id: string; kind: string }) =>
        e.id === "dataset-3664" && e.kind === "strength",
    ),
  );
  for (const exercise of data.exercises) {
    assert.match(exercise.id, /^dataset-\d{4}$/);
    assert.equal(exercise.nameAr, null);
    assert.equal(exercise.instructionsAr, null);
    assert.ok(exercise.category && exercise.bodyPart && exercise.targetMuscle);
    assert.ok(
      exercise.equipment && exercise.equipmentAr && exercise.instructions,
    );
    for (const excluded of [
      "image",
      "gif_url",
      "media_id",
      "instruction_steps",
    ])
      assert.equal(excluded in exercise, false);
  }
  for (const excluded of ["image", "gif_url", "media_id", "instruction_steps"])
    assert.ok(data.source.excludedFields.includes(excluded));
});
test("WGER additions retain separate per-record licences and disclose unavailable source instructions", async () => {
  const data = await wgerExerciseCatalog();
  assert.equal(data.source.project, "wger-project/wger");
  assert.equal(data.source.recordCount, 46);
  assert.equal(data.records.length, 46);
  assert.equal(
    data.recordsSha256,
    "19c41f18aafff7e37d6bd31925ed0b71665881e6e059cf6b090a5f30a111db04",
  );
  assert.equal(new Set(data.records.map((r: { id: string }) => r.id)).size, 46);
  assert.equal(
    data.records.filter(
      (r: { instructionStatus: string }) => r.instructionStatus === "source",
    ).length,
    24,
  );
  assert.equal(
    data.records.filter(
      (r: { instructionStatus: string }) =>
        r.instructionStatus === "translated_from_upstream",
    ).length,
    7,
  );
  assert.equal(
    data.records.filter(
      (r: { instructionStatus: string }) =>
        r.instructionStatus === "rafik_editorial_overlay",
    ).length,
    14,
  );
  assert.equal(
    data.records.find((r: { id: string }) => r.id === "wger-341")
      .instructionStatus,
    "rafik_authored",
  );
  assert.equal(
    data.records.find((r: { id: string }) => r.id === "wger-12").targetMuscle,
    "unspecified",
  );
  assert.doesNotMatch(
    data.records.find((r: { id: string }) => r.id === "wger-75").instructions,
    /Translated with DeepL/i,
  );
  for (const record of data.records) {
    assert.match(record.id, /^wger-\d+$/);
    assert.equal(record.nameAr, null);
    assert.equal(record.instructionsAr, null);
    assert.ok(record.instructions);
    assert.equal(record.kind, "strength");
    assert.equal(
      record.exerciseLicense.short_name.startsWith("CC-") ||
        record.exerciseLicense.short_name === "CC0",
      true,
    );
    assert.ok(Number.isInteger(record.translationLicense.id));
    assert.equal("media_ref" in record, false);
    assert.equal("image_url_main" in record, false);
  }
});
test("all reviewed illustrations have immutable URLs, safe vectors, hashes and retained attribution", async () => {
  const manifest = await exerciseMediaCatalog();
  assert.equal(manifest.items.length, 10);
  const starter = JSON.parse(
    await readFile(new URL("../content/starter.json", import.meta.url), "utf8"),
  );
  for (const item of manifest.items)
    assert.equal(
      starter.exercises.find((e: { id: string }) => e.id === item.exerciseId)
        ?.media_ref,
      item.id,
    );
  for (const e of starter.exercises)
    if (e.media_ref)
      assert.ok(
        manifest.items.some((item: { id: string }) => item.id === e.media_ref),
      );
  let total = 0;
  for (const item of manifest.items) {
    assert.equal(item.frames.length, 3);
    assert.equal(item.modified, false);
    assert.equal(item.attribution.license, "CC BY-SA 4.0");
    for (const frame of item.frames) {
      const result = await exerciseMediaAsset(item.id, String(frame.index));
      total += result.bytes.length;
      assert.equal(
        createHash("sha256").update(result.bytes).digest("hex"),
        frame.sha256,
      );
      assert.doesNotMatch(
        result.bytes.toString(),
        /<(?:script|foreignObject|image|animate|set)\b|\bon\w+\s*=|\bhref\s*=|url\s*\(|@import/i,
      );
      assert.equal(frame.width, 512);
      assert.equal(frame.height, 512);
      if (existsSync(new URL("../frontend/", import.meta.url))) {
        const web = await readFile(
          new URL(
            `../frontend/public/exercise-media/${item.id}/${frame.index}.svg`,
            import.meta.url,
          ),
        );
        assert.deepEqual(web, result.bytes);
      }
    }
  }
  assert.ok(total < 1000000);
  await assert.rejects(exerciseMediaAsset("../private", "1"));
  await assert.rejects(exerciseMediaAsset(manifest.items[0].id, "4"));
  const response = await fetch(apiOrigin + manifest.items[0].frames[0].path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/svg+xml");
  assert.match(response.headers.get("cache-control")!, /immutable/);
  assert.match(response.headers.get("content-security-policy")!, /sandbox/);
});
