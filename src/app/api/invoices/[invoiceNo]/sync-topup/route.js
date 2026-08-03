import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { syncTopupStatus } from "@/models/invoiceModel";

const TOPUP_STATUSES = ["Successfull", "Successful", "Pending", "Failed", "Declined"];

export const PATCH = asyncHandler(async (request, { params }) => {
  const { invoiceNo } = await params;
  const body = await readJsonBody(request);

  const status = optionalString(body.status ?? body.topupStatus, 50);
  if (!status) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "status is required.");
  }

  const invoice = await syncTopupStatus(invoiceNo, status);
  if (!invoice) {
    return notFound("Invoice not found.");
  }
  return ok({ message: "Topup status synced.", invoice });
});
