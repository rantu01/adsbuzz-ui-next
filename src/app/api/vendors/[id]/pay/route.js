import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, requirePositiveNumber, optionalString } from "@/utils/validate";
import { getVendorById, recordVendorPayment } from "@/models/vendorModel";

export const dynamic = 'force-dynamic';

export const POST = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const vendor = await getVendorById(id);
  if (!vendor) {
    return notFound("Vendor not found.");
  }

  const amountUSD = requirePositiveNumber(body.amountUSD, "amountUSD");
  const paymentMethod = optionalString(body.paymentMethod, 200);
  if (!paymentMethod) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "paymentMethod is required.");
  }

  const updated = await recordVendorPayment(id, {
    amountUSD,
    paymentMethod,
    date: body.date,
    transactionId: body.transactionId,
  });

  return ok({ message: "Payment recorded.", vendor: updated }, HttpStatus.CREATED);
});
