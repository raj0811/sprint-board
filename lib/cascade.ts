import "server-only";
import type { Db, Document } from "mongodb";

/** Deletes the matching tasks and everything attached to them (subtasks, comments, canvases). */
export async function deleteTasksWhere(db: Db, filter: Document) {
  const tasks = await db.collection("tasks").find(filter, { projection: { _id: 1 } }).toArray();
  const ids = tasks.map((task) => task._id);
  if (!ids.length) return 0;
  await Promise.all([
    db.collection("subtasks").deleteMany({ taskId: { $in: ids } }),
    db.collection("comments").deleteMany({ taskId: { $in: ids } }),
    db.collection("canvases").deleteMany({ taskId: { $in: ids } }),
  ]);
  const result = await db.collection("tasks").deleteMany({ _id: { $in: ids } });
  return result.deletedCount;
}
