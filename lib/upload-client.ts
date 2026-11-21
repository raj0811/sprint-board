import { ACCEPTED_IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES_PER_UPLOAD } from "@/lib/images";

/** Checks files in the browser before uploading, so obvious problems don't need a round trip. */
export function checkImageFiles(files: File[]): string | null {
  if (!files.length) return "Choose an image to upload.";
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return `“${file.name}” isn't a supported image (PNG, JPG, GIF, WebP or BMP).`;
    if (file.size > MAX_IMAGE_BYTES) return `“${file.name}” is larger than ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}

/**
 * Posts images as multipart `image` fields. Large selections are sent in batches the server accepts.
 * Never throws; failures come back as `error`.
 */
export async function uploadImages(url: string, files: File[]): Promise<{ error?: string }> {
  const problem = checkImageFiles(files);
  if (problem) return { error: problem };
  try {
    for (let start = 0; start < files.length; start += MAX_IMAGES_PER_UPLOAD) {
      const form = new FormData();
      for (const file of files.slice(start, start + MAX_IMAGES_PER_UPLOAD)) form.append("image", file, file.name);
      const response = await fetch(url, { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) return { error: result.error ?? "Unable to upload. Please try again." };
    }
    return {};
  } catch {
    return { error: "Could not connect. Please try again." };
  }
}
