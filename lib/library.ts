import "server-only";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { videoProjects } from "@/lib/db/schema";
import { MEDIA_DIR, resolveMedia, writeMedia } from "@/lib/media";
import { projectName } from "@/lib/presets";

// The user's reusable asset library ("Pustaka"): every picture they upload is also kept in
// MEDIA_DIR/Pustaka (named by content hash, so the same photo is stored once). Projects copy what
// they pick into their own folder, so deleting from the library never breaks a project.

export const LIBRARY = "Pustaka";
const IMG = /\.(png|jpe?g|webp)$/i;

export type LibraryItem = { rel: string; name: string; at: number; source?: string };

/** Store an uploaded picture in the library (deduped). Returns its MEDIA_DIR-relative path. */
export async function addToLibrary(data: Buffer, ext: string, originalName?: string) {
  const hash = createHash("sha1").update(data).digest("hex").slice(0, 16);
  const base = (originalName ?? "gambar").replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "gambar";
  const dir = path.join(MEDIA_DIR, LIBRARY);
  await fs.mkdir(dir, { recursive: true });
  const existing = (await fs.readdir(dir)).find((f) => f.includes(hash));
  if (existing) return `${LIBRARY}/${existing}`;
  return writeMedia(`${LIBRARY}/${base}-${hash}${ext}`, data);
}

/** First run: seed the library with photos uploaded before it existed (product photos + own scene images). */
async function backfill(dir: string) {
  const exists = await fs.stat(dir).then(() => true, () => false);
  if (exists) return;
  await fs.mkdir(dir, { recursive: true });
  const rows = await db.select().from(videoProjects);
  const rels = rows.flatMap((p) => [...p.product.photos, ...p.scenes.filter((s) => s.own && s.image).map((s) => s.image!)]);
  for (const rel of rels) {
    const data = await fs.readFile(resolveMedia(rel)).catch(() => null);
    if (data) await addToLibrary(data, path.extname(rel).toLowerCase(), path.basename(rel));
  }
}

export async function listUploads(): Promise<LibraryItem[]> {
  const dir = path.join(MEDIA_DIR, LIBRARY);
  await backfill(dir);
  const files = await fs.readdir(dir).catch(() => [] as string[]);
  const items = await Promise.all(
    files.filter((f) => IMG.test(f)).map(async (f) => ({ rel: `${LIBRARY}/${f}`, name: f.replace(/-[0-9a-f]{16}(?=\.)/, ""), at: (await fs.stat(path.join(dir, f))).mtimeMs })),
  );
  return items.sort((a, b) => b.at - a.at);
}

/** AI scene images from every project (newest first), so good results can be reused as references. */
export async function listGenerated(limit = 200): Promise<LibraryItem[]> {
  const rows = await db.select().from(videoProjects).orderBy(desc(videoProjects.updatedAt));
  const out: LibraryItem[] = [];
  for (const p of rows) {
    for (const s of p.scenes) {
      if (s.image && !s.own) out.push({ rel: s.image, name: s.label, at: s.finishedAt ?? p.updatedAt.getTime(), source: projectName(p) });
    }
  }
  return out.slice(0, limit);
}

export async function removeFromLibrary(rel: string) {
  if (!rel.startsWith(`${LIBRARY}/`) || rel.includes("..")) throw new Error("Hanya unggahan di Pustaka yang bisa dihapus di sini.");
  await fs.rm(resolveMedia(rel), { force: true });
}

/** Copy a library/AI picture into a project folder (projects stay self-contained). */
export async function copyIntoProject(rel: string, destRelNoExt: string) {
  if (!IMG.test(rel)) throw new Error("File bukan gambar.");
  const data = await fs.readFile(resolveMedia(rel));
  return writeMedia(destRelNoExt + path.extname(rel).toLowerCase(), data);
}
