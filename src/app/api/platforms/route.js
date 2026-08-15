import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { listPlatforms, createPlatform } from "@/models/platformModel";

export const GET = asyncHandler(async (request) => {
  const platforms = await listPlatforms();
  return ok({ platforms, total: platforms.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const platformId = optionalString(body.platformId, 100);
  const platformName = optionalString(body.platformName, 200);
  const platformLogo = optionalString(body.platformLogo, 200);

  if (!platformName) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Platform name is required.");
  }

  try {
    const platform = await createPlatform({
      platformId,
      platformName,
      platformLogo,
      status: body.status,
    });
    return ok({ message: "Platform created.", platform }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "DUPLICATE") {
      throw new ApiError(HttpStatus.CONFLICT, "A platform with this code already exists.");
    }
    if (err.message === "DUPLICATE_NAME") {
      throw new ApiError(HttpStatus.CONFLICT, "A platform with this name already exists.");
    }
    throw err;
  }
});
