import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { addPaymentMethod } from "@/models/settingsModel";

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);
  const name = optionalString(body.name ?? body.paymentMethod, 200);

  if (!name) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Payment method name is required.");
  }

  const settings = await addPaymentMethod(name);
  return ok({ message: "Payment method added.", settings }, HttpStatus.CREATED);
});
