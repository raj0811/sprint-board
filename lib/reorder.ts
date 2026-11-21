import "server-only";
import { ObjectId, type Db, type Document } from "mongodb";

export const MAX_REORDER_ITEMS = 500;

/** Validates a list of ids from a reorder request: ObjectIds, unique, and not too many. */
export function parseIdList(value: unknown): ObjectId[] | null {
  if (!Array.isArray(value) || value.length > MAX_REORDER_ITEMS) return null;
  if (!value.every((id) => typeof id === "string" && ObjectId.isValid(id))) return null;
  if (new Set(value).size !== value.length) return null;
  return value.map((id: string) => new ObjectId(id));
}

/**
 * Sets `order` (0, 1, 2 …) on each document in the given sequence.
 * `scope` limits updates to documents the caller may change (e.g. the same project), so foreign ids are ignored.
 */
export async function applyOrder(db: Db, collection: string, scope: Document, ids: ObjectId[], extra: (index: number) => Document = () => ({})) {
  if (!ids.length) return;
  const now = new Date();
  await db.collection(collection).bulkWrite(ids.map((_id, index) => ({
    updateOne: { filter: { ...scope, _id }, update: { $set: { order: index, updatedAt: now, ...extra(index) } } },
  })), { ordered: false });
}
