import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { finalRejectInvoice } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const reason = optionalString(body.reason, 1000);
  if (!reason) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "A reject reason is required.");
  }

  const actor = await getRequestActor(request);
  const invoice = await finalRejectInvoice(id, { reason, actor });
  if (!invoice) {
    return notFound("Topup invoice not found.");
  }
  return ok({ message: "Topup finally rejected.", invoice });
});
