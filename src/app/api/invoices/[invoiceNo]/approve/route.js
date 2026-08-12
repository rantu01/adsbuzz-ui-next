import { asyncHandler, ok, notFound } from "@/utils/http";
import { approveInvoice } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";
import { cacheInvalidate } from "@/lib/cache";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { invoiceNo } = await params;
  const actor = await getRequestActor(request);
  const invoice = await approveInvoice(invoiceNo, { actor });
  if (!invoice) {
    return notFound("Invoice not found.");
  }
  cacheInvalidate("GET:/api/invoices");
  cacheInvalidate("GET:/api/customers");
  return ok({ message: "Invoice approved.", invoice });
});
