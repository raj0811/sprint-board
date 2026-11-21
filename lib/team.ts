import "server-only";
import { ObjectId, type Db, type Document } from "mongodb";
import { getDatabase } from "@/lib/mongodb";

export type TeamMember = { id: string; name: string; email: string; role: "owner" | "member" };
export type TeamInvite = { id: string; email: string; createdAt: string };
export type Team = { isOwner: boolean; members: TeamMember[]; invites: TeamInvite[] };

/** The owner's user id. Projects store it as `ownerId`; older data may use `owner_id` or `userId`. */
export function ownerIdOf(project: Document) {
  return String(project.ownerId ?? project.owner_id ?? project.userId ?? "");
}

export function isProjectOwner(project: Document, userId: string) {
  return ownerIdOf(project) === userId;
}

function memberIdsOf(project: Document): string[] {
  return Array.isArray(project.memberIds) ? project.memberIds.map(String) : [];
}

export async function getProjectTeam(db: Db, project: Document, currentUserId: string): Promise<Team> {
  const ownerId = ownerIdOf(project);
  const ids = [ownerId, ...memberIdsOf(project)].filter((id, index, all) => ObjectId.isValid(id) && all.indexOf(id) === index);
  const [users, invites] = await Promise.all([
    db.collection("users").find({ _id: { $in: ids.map((id) => new ObjectId(id)) } }, { projection: { name: 1, email: 1 } }).toArray(),
    db.collection("invites").find({ projectId: project._id }).sort({ createdAt: -1 }).toArray(),
  ]);
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const members: TeamMember[] = ids.flatMap((id) => {
    const user = byId.get(id);
    if (!user) return [];
    return [{ id, name: String(user.name || user.email || "Unknown"), email: String(user.email ?? ""), role: id === ownerId ? "owner" as const : "member" as const }];
  });
  return {
    isOwner: ownerId === currentUserId,
    members,
    invites: invites.map((invite) => ({
      id: String(invite._id),
      email: String(invite.email),
      createdAt: invite.createdAt instanceof Date ? invite.createdAt.toISOString() : "",
    })),
  };
}

/** Turns invites sent to this email into project memberships. Called after sign-up and sign-in. */
export async function acceptPendingInvites(userId: string, email: string) {
  const db = await getDatabase();
  const invites = await db.collection("invites").find({ email: email.trim().toLowerCase() }).toArray();
  if (!invites.length) return;
  const userObjectId = new ObjectId(userId);
  await Promise.all(invites.map((invite) =>
    db.collection("projects").updateOne({ _id: invite.projectId }, { $addToSet: { memberIds: userObjectId }, $set: { updatedAt: new Date() } })));
  await db.collection("invites").deleteMany({ _id: { $in: invites.map((invite) => invite._id) } });
}
