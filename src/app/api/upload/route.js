import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { MAX_BYTES, MIME_TO_EXT, parseDataUrl, persistDataUrl } from "@/utils/upload";
import logger from "@/utils/logger";

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

  const url = await persistDataUrl({ data, name: body?.name });
  if (!url) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Image data could not be persisted.");
  }

  logger.info(`upload: saved ${url.split("/").pop()} (${buffer.length} bytes)`);

  return ok({ message: "Upload complete.", url, size: buffer.length }, HttpStatus.CREATED);
});
