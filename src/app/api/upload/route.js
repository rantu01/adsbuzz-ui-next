import { promises as fs } from "fs";
import path from "path";
import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import config from "@/config";
import logger from "@/utils/logger";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

function parseDataUrl(value = "") {
  const str = String(value);
  if (!str.startsWith("data:")) return null;
  const match = /^data:([^;,]+);base64,(.+)$/.exec(str);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), base64: match[2] };
}

function sanitizeName(name = "") {
  const cleaned = String(name || "screenshot")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  return cleaned || "screenshot";
}

function resolveRelativeDir() {
  const raw = String(config.upload.path || "uploads").replace(/\\/g, "/");
  const segs = raw.replace(/^public\//, "").replace(/^\.?\//, "").split("/").filter(Boolean);
  return segs.length > 0 ? segs : ["uploads"];
}

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const data = body?.data;
  if (!data) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "data (base64 image) is required.");
  }

  const parsed = parseDataUrl(data);
  if (!parsed) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid image data URL.");
  }

  const ext = MIME_TO_EXT[parsed.mime];
  if (!ext) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Unsupported image type. Use PNG, JPG, JPEG, WebP or GIF.");
  }

  let buffer;
  try {
    buffer = Buffer.from(parsed.base64, "base64");
  } catch {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Image data could not be decoded.");
  }

  if (buffer.length === 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Image data is empty.");
  }
  if (buffer.length > MAX_BYTES) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      `Image is too large. Maximum allowed size is 5 MB (uploaded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB).`
    );
  }

  const rawName = sanitizeName(body?.name);
  const stem = rawName.replace(/\.[^/.]+$/, "") || "screenshot";
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${stem}${ext}`;

  const relativeDir = resolveRelativeDir();
  const publicDir = path.join(process.cwd(), "public");
  const absoluteDir = path.join(publicDir, ...relativeDir);
  await fs.mkdir(absoluteDir, { recursive: true });
  await fs.writeFile(path.join(absoluteDir, fileName), buffer);

  const url = `/${relativeDir.join("/")}/${fileName}`;
  logger.info(`upload: saved ${fileName} (${buffer.length} bytes)`);

  return ok({ message: "Upload complete.", url, size: buffer.length }, HttpStatus.CREATED);
});
