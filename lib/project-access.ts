import "server-only";
import { ObjectId, type Db, type Document } from "mongodb";

export async function findAccessibleProject(db: Db, userId: string, projectId: string) {
  if (!ObjectId.isValid(projectId) || !ObjectId.isValid(userId)) return null;
  const userIds = [new ObjectId(userId), userId];
  return db.collection("projects").findOne({
    _id: new ObjectId(projectId),
    $or: [
      { ownerId: { $in: userIds } },
      { userId: { $in: userIds } },
      { owner_id: { $in: userIds } },
      { memberIds: { $in: userIds } },
    ],
  } as Document);
}
