"use server";

import { revalidatePath } from "next/cache";
import { addToLibrary, removeFromLibrary } from "@/lib/library";

const TYPES: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp" };

export async function uploadToLibrary(form: FormData) {
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) throw new Error("Pilih gambar dulu.");
  if (files.length > 30) throw new Error("Maksimal 30 gambar sekali unggah.");
  for (const f of files) {
    const ext = TYPES[f.type];
    if (!ext) throw new Error(`${f.name}: format harus PNG, JPG, atau WEBP.`);
    if (f.size > 12 * 1024 * 1024) throw new Error(`${f.name}: maksimal 12 MB.`);
    await addToLibrary(Buffer.from(await f.arrayBuffer()), ext, f.name);
  }
  revalidatePath("/galeri");
  return files.length;
}

export async function deleteFromLibrary(rel: string) {
  await removeFromLibrary(rel);
  revalidatePath("/galeri");
}
