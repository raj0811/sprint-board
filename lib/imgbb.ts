import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES_PER_UPLOAD } from "@/lib/images";

/** What MongoDB stores for each image. `deleteUrl` is imgbb's manual delete page and never leaves the server. */
export type StoredImage = {
  id: string;
  url: string;
  thumbUrl: string;
  name: string;
  width: number;
  height: number;
  size: number;
  deleteUrl: string;
  uploadedBy: string;
  createdAt: Date;
};

type ImgbbResponse = {
  success?: boolean;
  data?: {
    url?: string;
    display_url?: string;
    width?: string | number;
    height?: string | number;
    size?: string | number;
    delete_url?: string;
    thumb?: { url?: string };
  };
  error?: { message?: string };
};

/** Reads the `image` files from a multipart request and checks type, size and count. */
export async function readImageFiles(request: Request, maxFiles = MAX_IMAGES_PER_UPLOAD): Promise<{ files: File[] } | { response: NextResponse }> {
  const fail = (error: string, status = 400) => ({ response: NextResponse.json({ error }, { status }) });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Send the images as a multipart form.");
  }
  const files = form.getAll("image").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return fail("Choose an image to upload.");
  if (files.length > maxFiles) return fail(`Upload at most ${maxFiles} ${maxFiles === 1 ? "image" : "images"} at a time.`);
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return fail(`“${file.name}” isn't a supported image (PNG, JPG, GIF, WebP or BMP).`);
    if (file.size > MAX_IMAGE_BYTES) return fail(`“${file.name}” is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`, 413);
  }
  return { files };
}

/** Uploads one image to imgbb (stored permanently) and returns the record to save. */
export async function uploadToImgbb(file: File, userId: string): Promise<StoredImage> {
  const key = process.env.IMGBB_API_KEY;
  if (!key) throw new Error("IMGBB_API_KEY is not set.");

  const body = new FormData();
  body.append("image", file, file.name);
  const name = file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "image";
  body.append("name", name);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(key)}`, { method: "POST", body, cache: "no-store" });
  const result = await response.json().catch(() => ({})) as ImgbbResponse;
  const data = result.data;
  if (!response.ok || !result.success || !data?.url) {
    throw new Error(`imgbb upload failed (${response.status}): ${result.error?.message ?? "no details"}`);
  }
  return {
    id: randomUUID(),
    url: data.url,
    thumbUrl: data.thumb?.url || data.display_url || data.url,
    name: file.name.slice(0, 200),
    width: Number(data.width) || 0,
    height: Number(data.height) || 0,
    size: Number(data.size) || file.size,
    deleteUrl: data.delete_url ?? "",
    uploadedBy: userId,
    createdAt: new Date(),
  };
}

/** Uploads several images in parallel. */
export function uploadAllToImgbb(files: File[], userId: string) {
  return Promise.all(files.map((file) => uploadToImgbb(file, userId)));
}

export function uploadFailedResponse(error: unknown) {
  console.error("Image upload failed", error);
  const missingKey = error instanceof Error && error.message.includes("IMGBB_API_KEY");
  return NextResponse.json({ error: missingKey ? "Image uploads aren't configured on the server (IMGBB_API_KEY is missing)." : "Unable to upload the image right now. Please try again." }, { status: missingKey ? 503 : 502 });
}
