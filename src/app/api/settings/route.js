import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { getSettings, updateSettings } from "@/models/settingsModel";

export const GET = asyncHandler(async () => {
  const settings = await getSettings();
  return ok({ settings });
});

export const PUT = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  if (body.defaultDollarRate !== undefined) {
    const rate = Number(body.defaultDollarRate);
    if (!(rate > 0) || !Number.isFinite(rate)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, "defaultDollarRate must be a positive number.");
    }
  }

  if (body.companyName !== undefined && !optionalString(body.companyName, 200)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "companyName cannot be empty.");
  }

  const settings = await updateSettings(body);
  return ok({ message: "Settings updated.", settings });
});
