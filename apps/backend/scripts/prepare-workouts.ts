import { prepareWorkouts } from "../server/workout-scheduler.ts";
import { db } from "../server/db.ts";
try {
  console.log(JSON.stringify(await prepareWorkouts()));
} finally {
  await db.$disconnect();
}
