"use client";

/* eslint-disable @next/next/no-img-element -- images are hosted on imgbb, which already serves sized thumbnails. */
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { send } from "@/lib/api-client";
import { ACCEPTED_IMAGE_TYPES, MAX_IMAGES_PER_ITEM, type ImageAttachment } from "@/lib/images";
import { uploadImages } from "@/lib/upload-client";

type ImageGalleryProps = {
  images: ImageAttachment[];
  /** POST endpoint for new images; each image is removed with DELETE `${apiBase}/${id}`. */
  apiBase: string;
  onError: (message: string) => void;
  /** "panel": a card with heading and grid (task page). "strip": a compact row of thumbnails (sprint header). */
  variant?: "panel" | "strip";
};

/** Thumbnails with upload (button, drag-and-drop or paste), remove, and a full-screen viewer. */
export function ImageGallery({ images, apiBase, onError, variant = "panel" }: ImageGalleryProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const full = images.length >= MAX_IMAGES_PER_ITEM;

  async function upload(files: File[]) {
    if (!files.length || uploading) return;
    const room = MAX_IMAGES_PER_ITEM - images.length;
    if (room <= 0) return onError(`You can attach up to ${MAX_IMAGES_PER_ITEM} images.`);
    setUploading(Math.min(files.length, room));
    const result = await uploadImages(apiBase, files.slice(0, room));
    setUploading(0);
    if (result.error) onError(result.error);
    router.refresh();
  }

  async function remove(image: ImageAttachment) {
    if (!window.confirm(`Remove “${image.name}”?`)) return;
    setRemoving(image.id);
    const result = await send(`${apiBase}/${image.id}`, "DELETE");
    setRemoving(null);
    if (result.error) onError(result.error);
    else {
      setViewing(null);
      router.refresh();
    }
  }

  const imageFiles = (list: FileList | null | undefined) => Array.from(list ?? []).filter((file) => file.type.startsWith("image/"));
  const dropProps = {
    onDragOver: (event: DragEvent) => { if (event.dataTransfer.types.includes("Files")) { event.preventDefault(); setDragOver(true); } },
    onDragLeave: (event: DragEvent) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOver(false); },
    onDrop: (event: DragEvent) => { event.preventDefault(); setDragOver(false); void upload(imageFiles(event.dataTransfer.files)); },
    onPaste: (event: ClipboardEvent) => { const files = imageFiles(event.clipboardData.files); if (files.length) { event.preventDefault(); void upload(files); } },
  };

  const picker = <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(",")} multiple hidden onChange={(event) => { void upload(imageFiles(event.target.files)); event.target.value = ""; }} />;
  const viewer = viewing !== null && images[viewing] && <ImageViewer images={images} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} onRemove={remove} removing={removing} />;
  const pending = Array.from({ length: uploading }, (_, index) => <li key={`pending-${index}`} className="grid aspect-square place-items-center rounded-xl border border-dashed border-brand-200 bg-brand-50 text-brand-500"><Spinner /></li>);

  if (variant === "strip") {
    return <div {...dropProps} tabIndex={-1} className={`mt-4 rounded-xl outline-none transition ${dragOver ? "ring-2 ring-brand-200" : ""}`}>
      {picker}
      <ul className="no-scrollbar m-0 flex list-none gap-2 overflow-x-auto p-0 [&>li]:size-16 [&>li]:shrink-0">
        {images.map((image, index) => <li key={image.id}>
          <button type="button" onClick={() => setViewing(index)} className="block size-full overflow-hidden rounded-xl border border-line bg-sunken hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand-200" aria-label={`View ${image.name}`} title={image.name}>
            <img src={image.thumbUrl} alt="" loading="lazy" className="size-full object-cover" />
          </button>
        </li>)}
        {pending}
        {!full && <li>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading > 0} className="grid size-full place-items-center rounded-xl border border-dashed border-line-strong text-muted hover:border-brand-200 hover:text-brand-600 disabled:opacity-50" aria-label="Attach images to sprint" title="Attach images (or drop / paste them here)">
            <span className="grid justify-items-center gap-0.5 text-[10px] font-medium"><Icon name="image" size={18} />{images.length ? "Add" : "Images"}</span>
          </button>
        </li>}
      </ul>
      {viewer}
    </div>;
  }

  return <section {...dropProps} tabIndex={-1} className={`relative rounded-2xl border bg-surface p-4 shadow-sm outline-none transition sm:p-5 ${dragOver ? "border-brand-200 ring-2 ring-brand-100" : "border-line"}`}>
    {picker}
    <div className="mb-3 flex items-center gap-2">
      <h2 className="m-0 flex items-center gap-2 text-base font-semibold"><Icon name="image" size={18} className="text-muted" />Images<span className="text-sm font-normal text-faint">{images.length}</span></h2>
      {!full && <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading > 0} className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink-soft hover:border-line-strong hover:bg-canvas disabled:opacity-60">
        {uploading ? <><Spinner />Uploading {uploading}…</> : <><Icon name="plus" size={16} />Add images</>}
      </button>}
    </div>

    {images.length === 0 && !uploading
      ? <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted hover:border-brand-200 hover:text-brand-600">
        <Icon name="image" size={24} />
        <span>Attach screenshots, mockups or photos. Drop files here, paste, or click to choose.</span>
      </button>
      : <ul className="m-0 grid list-none grid-cols-3 gap-2 p-0 sm:grid-cols-4 lg:grid-cols-5">
        {images.map((image, index) => <li key={image.id} className="group relative aspect-square">
          <button type="button" onClick={() => setViewing(index)} className="block size-full overflow-hidden rounded-xl border border-line bg-sunken hover:border-line-strong focus-visible:ring-2 focus-visible:ring-brand-200" aria-label={`View ${image.name}`} title={image.name}>
            <img src={image.thumbUrl} alt="" loading="lazy" className={`size-full object-cover transition ${removing === image.id ? "opacity-40" : ""}`} />
          </button>
          <button type="button" onClick={() => remove(image)} disabled={removing === image.id} className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-lg bg-black/60 text-white transition-opacity hover:bg-danger-ink focus:opacity-100 can-hover:opacity-0 can-hover:group-hover:opacity-100" aria-label={`Remove ${image.name}`}><Icon name="trash" size={14} /></button>
        </li>)}
        {pending}
      </ul>}
    {dragOver && <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-2xl bg-brand-50/80 text-sm font-semibold text-brand-700">Drop images to attach</div>}
    {viewer}
  </section>;
}

function Spinner() {
  return <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}

type ImageViewerProps = {
  images: ImageAttachment[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  onRemove: (image: ImageAttachment) => void;
  removing: string | null;
};

/** Full-screen viewer: arrow keys / buttons to move between images, Escape to close. */
function ImageViewer({ images, index, onIndex, onClose, onRemove, removing }: ImageViewerProps) {
  const image = images[index];
  const count = images.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowRight" && count > 1) onIndex((index + 1) % count);
      else if (event.key === "ArrowLeft" && count > 1) onIndex((index - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [index, count, onIndex, onClose]);

  const navButton = "grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20";
  return <div role="dialog" aria-modal="true" aria-label={image.name} className="fixed inset-0 z-[70] flex flex-col bg-black/90 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="flex h-14 shrink-0 items-center gap-2 px-3 pt-[env(safe-area-inset-top)] text-sm text-white/80 sm:px-5">
      <span className="min-w-0 flex-1 truncate">{image.name}{count > 1 && <span className="ml-2 text-white/50">{index + 1} / {count}</span>}</span>
      <a href={image.url} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-lg px-3 hover:bg-white/10">Open original</a>
      <button type="button" onClick={() => onRemove(image)} disabled={removing === image.id} className="grid size-9 place-items-center rounded-lg hover:bg-white/10 hover:text-[#f28b82] disabled:opacity-50" aria-label={`Remove ${image.name}`} title="Remove image"><Icon name="trash" size={17} /></button>
      <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-lg hover:bg-white/10" aria-label="Close viewer"><Icon name="close" /></button>
    </div>
    <div className="flex min-h-0 flex-1 items-center justify-center gap-3 px-2 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {count > 1 && <button type="button" onClick={() => onIndex((index - 1 + count) % count)} className={navButton} aria-label="Previous image"><Icon name="back" /></button>}
      <img key={image.id} src={image.url} alt={image.name} className="max-h-full min-w-0 max-w-full rounded-lg object-contain shadow-2xl" />
      {count > 1 && <button type="button" onClick={() => onIndex((index + 1) % count)} className={navButton} aria-label="Next image"><Icon name="chev" /></button>}
    </div>
  </div>;
}
