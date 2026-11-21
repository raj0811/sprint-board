import "server-only";
import { ObjectId, type Db } from "mongodb";

export type Feature = { id: string; title: string; done: boolean };

export const MAX_FEATURE_LENGTH = 200;
export const MAX_FEATURES_PER_PROJECT = 100;

export async function listFeatures(db: Db, projectId: ObjectId): Promise<Feature[]> {
  const docs = await db.collection("features").find({ projectId }).sort({ order: 1, createdAt: 1 }).toArray();
  return docs.map((doc) => ({ id: String(doc._id), title: String(doc.title ?? ""), done: doc.done === true }));
}

/** Inserts features at the end of the project's list. Titles are trimmed; blanks are skipped. */
export async function addFeatures(db: Db, projectId: ObjectId, userId: string, titles: string[]) {
  const clean = titles.map((title) => title.trim().slice(0, MAX_FEATURE_LENGTH)).filter(Boolean);
  if (!clean.length) return [];
  const last = await db.collection("features").find({ projectId }).sort({ order: -1 }).limit(1).next();
  const start = typeof last?.order === "number" ? last.order + 1 : 0;
  const now = new Date();
  const result = await db.collection("features").insertMany(clean.map((title, index) => ({
    projectId, title, done: false, order: start + index, createdBy: new ObjectId(userId), createdAt: now, updatedAt: now,
  })));
  return Object.values(result.insertedIds).map(String);
}
