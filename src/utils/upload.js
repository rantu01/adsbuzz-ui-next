import { promises as fs } from "fs";
import path from "path";
import config from "@/config";

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export const MIME_TO_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function parseDataUrl(value = "") {
  const str = String(value);
  if (!str.startsWith("data:")) return null;
  const match = /^data:([^;,]+);base64,(.+)$/.exec(str);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

export function sanitizeName(name = "") {
  const cleaned = String(name || "screenshot")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  return cleaned || "screenshot";
}

export function resolveRelativeDir() {
  const raw = String(config.upload.path || "uploads").replace(/\\/g, "/");
  const segs = raw.replace(/^public\//, "").replace(/^\.?\//, "").split("/").filter(Boolean);
  return segs.length > 0 ? segs : ["uploads"];
}

export function buildFileName(name = "", mime) {
  const ext = MIME_TO_EXT[mime];
  const rawName = sanitizeName(name);
  const stem = rawName.replace(/\.[^/.]+$/, "") || "screenshot";
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${stem}${ext}`;
}

export async function persistDataUrl({ data, name = "screenshot.png" } = {}) {
  const parsed = parseDataUrl(data);
  if (!parsed) return null;
  const ext = MIME_TO_EXT[parsed.mime];
  if (!ext) return null;

  let buffer;
  try {
    buffer = Buffer.from(parsed.base64, "base64");
  } catch {
    return null;
  }
  if (!buffer || buffer.length === 0 || buffer.length > MAX_BYTES) return null;

  const fileName = buildFileName(name, parsed.mime);
  const relativeDir = resolveRelativeDir();
  const publicDir = path.join(process.cwd(), "public");
  const absoluteDir = path.join(publicDir, ...relativeDir);
  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(path.join(absoluteDir, fileName), buffer);
  return `/${relativeDir.join("/")}/${fileName}`;
}
