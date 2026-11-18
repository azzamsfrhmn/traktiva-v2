import fs from "node:fs";
import { Readable } from "node:stream";
import { mimeOf, resolveMedia } from "@/lib/media";

// Serves files from the user's media folder (images + videos) with Range support so <video> can seek.
// Only paths inside MEDIA_DIR are allowed (resolveMedia rejects traversal).
export async function GET(req: Request, { params }: RouteContext<"/api/media/[...path]">) {
  let file: string;
  try {
    file = resolveMedia((await params).path.map(decodeURIComponent).join("/"));
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("Not found", { status: 404 });

  const size = fs.statSync(file).size;
  const download = new URL(req.url).searchParams.has("download");
  const headers: Record<string, string> = {
    "content-type": mimeOf(file),
    "accept-ranges": "bytes",
    "cache-control": "no-store",
    ...(download ? { "content-disposition": `attachment; filename="${encodeURIComponent(file.split(/[\\/]/).pop()!)}"` } : {}),
  };
  const range = req.headers.get("range")?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { headers: { ...headers, "content-length": String(size) } });
}
