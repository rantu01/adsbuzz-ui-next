import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { removePaymentMethod } from "@/models/settingsModel";

export const DELETE = asyncHandler(async (request, { params }) => {
  const { name } = await params;
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    decoded = name;
  }

  if (!decoded.trim()) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Payment method name is required.");
  }

  const settings = await removePaymentMethod(decoded);
  return ok({ message: "Payment method deleted.", settings });
});
