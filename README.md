# Orbit

Sprint planning app built with Next.js, Tailwind CSS, and MongoDB.

## Run locally

Keep the MongoDB connection string in the root `.env` file as `DB`. A random `SESSION_SECRET` is also required for signed login sessions. Both are server-only values and `.env` is ignored by Git.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first visit redirects to `/login`. Create an account or sign in; passwords are stored as scrypt hashes in MongoDB.

## MongoDB collections

- `users`: created by registration with `name`, normalized `email`, and `passwordHash`.
- `projects`: project creation stores `name`, `description`, `ownerId`, and timestamps. The board lists projects where `ownerId`, `userId`, `owner_id`, or `memberIds` matches the signed-in user's ObjectId or string id.
- `sprints`: created within a project with `projectId`, `name`, `description`, `status`, `startDate`, `deadline` (also written as `endDate` for older board data), and timestamps. The board lets users switch between sprints for the selected project; sprint title, description, and dates can be edited.
- `tasks`: created within the selected sprint with `projectId`, `sprintId`, `key`, `title`, `description`, `startDate`, `deadline`, `type`, `priority`, `status`, `assigneeName`, and timestamps. Task title, description, and dates can be edited; tasks can be deleted; status can be changed among `To do`, `In progress`, and `Done`.
- `subtasks`: created from a task's page (`/tasks/<id>`) with `projectId`, `taskId`, `title`, `status` (`To do`, `In progress`, `Done`), and timestamps. Deleting a subtask deletes its comments.
- `invites`: pending team invites with `projectId`, normalized `email`, `invitedBy`, and `createdAt`. The project owner invites people from the **Team** button; an existing user is added to the project's `memberIds` straight away, otherwise the invite waits and is turned into membership when someone signs up (or signs in) with that email. Members can see and edit all sprints, tasks, subtasks, and comments in the project; only the owner can invite or remove people, and members can leave.
- `canvases`: whiteboards attached to a task (`projectId`, `taskId`, `title`, Excalidraw `elements` and `files`, `viewBackgroundColor`, a `previewSvg` thumbnail, `updatedByName`, and timestamps). Created from the task page and edited full-screen at `/canvas/<id>` with autosave (also Ctrl+S). Scenes are capped at 8 MB. Deleting a task deletes its canvases.
- `features`: a project's key features checklist with `projectId`, `title`, `done`, `completedAt`, `order`, and timestamps. Add them in the **New project** form or in the **Key features** card on the board, where any team member can tick them off, rename, or delete them.
- `comments`: posted on a task or one of its subtasks with `projectId`, `taskId`, `subtaskId` (null for task-level comments), `body`, `authorId`, `authorName`, and `createdAt`. Only the author can delete a comment. Deleting a task deletes its subtasks and comments.

Sprints, tasks, subtasks, key features, and sidebar projects can be rearranged by dragging (sprint tabs sideways; everything else by its ⋮⋮ handle — press and hold on touch screens). The sequence is stored in an `order` field on each sprint, task, subtask, and feature; dragging a task to another column also updates its `status`. Project order is personal, saved as `projectOrder` on the user, because shared projects appear in several sidebars.

The board data is read from MongoDB on the server. When no project belongs to the signed-in user, the app shows an empty workspace instead of sample data.
