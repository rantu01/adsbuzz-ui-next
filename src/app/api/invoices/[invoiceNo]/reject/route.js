import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { rejectInvoice } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";
import { cacheInvalidate } from "@/lib/cache";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { invoiceNo } = await params;
  const actor = await getRequestActor(request);
  let reason = "";
  try {
    const body = await readJsonBody(request);
    reason = optionalString(body.reason, 1000) || "";
  } catch {
    // Body is optional here; the audit page always passes a reason.
  }
  const invoice = await rejectInvoice(invoiceNo, { reason, actor });
  if (!invoice) {
    return notFound("Invoice not found.");
  }
  cacheInvalidate("GET:/api/invoices");
  cacheInvalidate("GET:/api/customers");
  return ok({ message: "Invoice rejected.", invoice });
});
