import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { syncTopupStatus } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";
import { cacheInvalidate } from "@/lib/cache";

const TOPUP_STATUSES = ["Successfull", "Successful", "Pending", "Failed", "Declined"];

export const PATCH = asyncHandler(async (request, { params }) => {
  const { invoiceNo } = await params;
  const body = await readJsonBody(request);

  const status = optionalString(body.status ?? body.topupStatus, 50);
  if (!status) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "status is required.");
  }

  const actor = await getRequestActor(request);
  const invoice = await syncTopupStatus(invoiceNo, status, { actor });
  if (!invoice) {
    return notFound("Invoice not found.");
  }
  cacheInvalidate("GET:/api/invoices");
  cacheInvalidate("GET:/api/customers");
  return ok({ message: "Topup status synced.", invoice });
});
