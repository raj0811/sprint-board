// Image attachments (project logos, sprint and task images). Files live on imgbb; MongoDB keeps the links.
// Client-safe: only types and plain helpers.

export type ImageAttachment = {
  id: string;
  /** Full-size image. */
  url: string;
  /** Small preview (falls back to the full image). */
  thumbUrl: string;
  name: string;
  width: number;
  height: number;
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGES_PER_ITEM = 30;
export const MAX_IMAGES_PER_UPLOAD = 10;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"];

/** Only links on imgbb's image hosts are ever rendered. */
function isImgbbUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "i.ibb.co" || url.hostname.endsWith(".ibb.co"));
  } catch {
    return false;
  }
}

/** Maps a stored attachment (or array of them) to the client shape, dropping anything malformed. */
export function toAttachment(value: unknown): ImageAttachment | null {
  if (!value || typeof value !== "object") return null;
  const doc = value as Record<string, unknown>;
  if (!isImgbbUrl(doc.url)) return null;
  return {
    id: String(doc.id ?? ""),
    url: doc.url,
    thumbUrl: isImgbbUrl(doc.thumbUrl) ? doc.thumbUrl : doc.url,
    name: typeof doc.name === "string" ? doc.name : "image",
    width: Number(doc.width) || 0,
    height: Number(doc.height) || 0,
  };
}

export function toAttachments(value: unknown): ImageAttachment[] {
  return Array.isArray(value) ? value.flatMap((item) => toAttachment(item) ?? []) : [];
}
