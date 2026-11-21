import "server-only";
import { NextResponse } from "next/server";
import type { Db, Document } from "mongodb";
import { readImageFiles, uploadAllToImgbb, uploadFailedResponse, type StoredImage } from "@/lib/imgbb";
import { MAX_IMAGES_PER_ITEM, MAX_IMAGES_PER_UPLOAD, toAttachment } from "@/lib/images";

/** Typed view of a sprint or task for the image updates. */
type WithImages = { images?: StoredImage[]; updatedAt?: Date };

/** Uploads the request's images to imgbb and appends them to `doc.images`. */
export async function appendImages(request: Request, db: Db, collection: "sprints" | "tasks", doc: Document, userId: string) {
  const existing = Array.isArray(doc.images) ? doc.images.length : 0;
  const room = MAX_IMAGES_PER_ITEM - existing;
  if (room <= 0) return NextResponse.json({ error: `You can attach up to ${MAX_IMAGES_PER_ITEM} images. Remove one to add more.` }, { status: 400 });

  const read = await readImageFiles(request, Math.min(MAX_IMAGES_PER_UPLOAD, room));
  if ("response" in read) return read.response;

  let stored;
  try {
    stored = await uploadAllToImgbb(read.files, userId);
  } catch (error) {
    return uploadFailedResponse(error);
  }
  await db.collection<WithImages>(collection).updateOne({ _id: doc._id }, { $push: { images: { $each: stored } }, $set: { updatedAt: new Date() } });
  return NextResponse.json({ images: stored.map(toAttachment) }, { status: 201 });
}

/** Removes one image from `doc.images`. (imgbb's free API can't delete files, so the hosted copy stays.) */
export async function removeImage(db: Db, collection: "sprints" | "tasks", doc: Document, imageId: string) {
  const result = await db.collection<WithImages>(collection).updateOne({ _id: doc._id }, { $pull: { images: { id: imageId } }, $set: { updatedAt: new Date() } });
  if (!result.modifiedCount) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
