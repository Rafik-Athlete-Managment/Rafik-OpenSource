/** Assignment-local snapshot; the library version and previously scheduled work stay immutable. */
export function effectivePlan<
  T extends {
    institution_versions: { title: string; prescription?: unknown };
    adaptation?: unknown;
  },
>(assignment: T): T["institution_versions"] {
  const local = assignment.adaptation as {
    title: string;
    prescription: unknown;
  } | null;
  return local
    ? {
        ...assignment.institution_versions,
        title: local.title,
        prescription: local.prescription,
      }
    : assignment.institution_versions;
}
export function adaptationRevision(assignment: { adaptation?: unknown }) {
  return (assignment.adaptation as { revision?: number } | null)?.revision || 0;
}
