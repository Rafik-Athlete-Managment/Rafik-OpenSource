// Explicit local operator action. No hosted credentials, outbound messaging or billing provider.
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { operator } from "./prisma/operator.mjs";
const [id, revision, file] = process.argv.slice(2);
if (
  !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id || "") ||
  !/^\d+$/.test(revision || "") ||
  !file
)
  throw Error(
    "Usage: npm run support:local -- <case UUID> <current revision> <reply text file>",
  );
const reply = readFileSync(file, "utf8").trim();
if (!reply || reply.length > 4000)
  throw Error("Reply must contain 1–4000 characters");
const result = operator("operator_support_reply", {
  p_id: id,
  p_revision: Number(revision),
  p_reply: reply,
});
console.log(
  `Local case ${result.id} resolved at revision ${result.revision}. No external message sent.`,
);
