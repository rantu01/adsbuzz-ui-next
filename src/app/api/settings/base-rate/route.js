import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, requirePositiveNumber } from "@/utils/validate";
import { updateBaseRate } from "@/models/settingsModel";

export const PUT = asyncHandler(async (request) => {
  const body = await readJsonBody(request);
  const rate = requirePositiveNumber(body.rate ?? body.defaultDollarRate, "rate");

  const settings = await updateBaseRate(rate);
  return ok({ message: "Base rate updated.", settings });
});
