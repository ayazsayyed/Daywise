/**
 * Whether an editor action may become a tenant learning (#14).
 *
 * Learnings feed the generation prompt, so only trustworthy, real-world
 * signals are kept:
 * - never in mock mode (`MOCK_AI=1`): fixture hotels and test edits are not
 *   agency preferences;
 * - a hotel swap counts only when the new hotel is a real Places result
 *   (has a `place_id`); manual entries may be invented or misspelt.
 */
export type LearningCandidate =
  | { kind: "hotel_swap"; placeId: string | null | undefined }
  | { kind: "stop_added" | "stop_removed" | "note" };

export function shouldRecordLearning(
  candidate: LearningCandidate,
  opts: { mockAi: boolean },
): boolean {
  if (opts.mockAi) return false;
  if (candidate.kind === "hotel_swap") return Boolean(candidate.placeId?.trim());
  return true;
}
