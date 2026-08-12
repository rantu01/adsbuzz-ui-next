import { asyncHandler, ok, notFound } from "@/utils/http";
import { finalApproveInvoice } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const actor = await getRequestActor(request);
  const invoice = await finalApproveInvoice(id, { actor });
  if (!invoice) {
    return notFound("Topup invoice not found.");
  }
  return ok({ message: "Final approval granted.", invoice });
});
