import { db, type Actor } from "./db.ts";
// Subject access for a personal export, including former memberships; never another athlete's records.
export async function institutionAccountData(actor: Actor) {
  const memberships = await db.institution_members.findMany({
    where: { user_id: actor.id, institutions: { kind: "organization" } },
    select: {
      id: true,
      institution_id: true,
      name: true,
      roles: true,
      active: true,
      joined_at: true,
      institutions: { select: { name: true, archived: true } },
    },
  });
  const ids = memberships.map((m) => m.id);
  const [assignments, sessions, calendar, results, corrections] =
    await Promise.all([
      db.institution_assignments.findMany({
        where: { member_id: { in: ids } },
        include: { institution_versions: true },
        orderBy: { created_at: "asc" },
      }),
      db.institution_sessions.findMany({
        where: { member_id: { in: ids } },
        orderBy: { started_at: "asc" },
      }),
      db.institution_event_people.findMany({
        where: { member_id: { in: ids } },
        include: { institution_events: true },
      }),
      db.assessment_results.findMany({ where: { member_id: { in: ids } } }),
      db.assessment_result_history.findMany({
        where: { member_id: { in: ids } },
        orderBy: { recorded_at: "asc" },
      }),
    ]);
  const [workoutHistory, workoutPositions, workoutRecurrences] =
    await Promise.all([
      db.institution_session_history.findMany({
        where: { institution_sessions: { member_id: { in: ids } } },
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
      }),
      db.institution_workout_positions.findMany({
        where: { institution_assignments: { member_id: { in: ids } } },
        orderBy: [{ assignment_id: "asc" }, { position: "asc" }],
      }),
      db.institution_workout_recurrences.findMany({
        where: { institution_assignments: { member_id: { in: ids } } },
        orderBy: { id: "asc" },
      }),
    ]);
  const [messages, notificationPreferences, notifications] = await Promise.all([
    db.institution_messages.findMany({
      where: { sender_id: { in: ids } },
      select: {
        id: true,
        channel_id: true,
        institution_id: true,
        body: true,
        asset_id: true,
        institution_message_assets: {
          select: { asset_id: true, position: true },
          orderBy: { position: "asc" },
        },
        created_at: true,
      },
      orderBy: { created_at: "asc" },
    }),
    db.notification_preferences.findUnique({ where: { user_id: actor.id } }),
    db.notification_events.findMany({
      where: { user_id: actor.id },
      select: {
        id: true,
        category: true,
        source_kind: true,
        created_at: true,
        read_at: true,
        state: true,
      },
    }),
  ]);
  const [nutritionPlans, nutritionSharing, nutritionMeals] = await Promise.all([
    db.institution_nutrition_plans.findMany({
      where: { member_id: { in: ids } },
      orderBy: { created_at: "asc" },
    }),
    db.institution_nutrition_sharing.findMany({
      where: { member_id: { in: ids } },
    }),
    db.institution_meals.findMany({
      where: { member_id: { in: ids } },
      include: { institution_meal_history: true },
      orderBy: { created_at: "asc" },
    }),
  ]);
  const assets =
    await db.$queryRaw`SELECT id,institution_id,purpose,channel_id,filename,media_type,bytes,retired,created_at FROM public.institution_assets WHERE owner_id=ANY(${ids}::uuid[])`;
  const sessionFeedback =
    await db.$queryRaw`SELECT * FROM public.institution_session_feedback WHERE member_id=ANY(${ids}::uuid[])`;
  const workplaceFeedback =
    await db.$queryRaw`SELECT * FROM public.institution_workplace_feedback WHERE member_id=ANY(${ids}::uuid[])`;
  return {
    workoutHistory,
    workoutPositions,
    workoutRecurrences,
    sessionFeedback,
    workplaceFeedback,
    assets,
    nutritionPlans,
    nutritionSharing,
    nutritionMeals,
    messages,
    notificationPreferences,
    notifications,
    calendar,
    results,
    corrections,
    memberships,
    assignments,
    sessions: sessions.map((s) => s.document),
  };
}
