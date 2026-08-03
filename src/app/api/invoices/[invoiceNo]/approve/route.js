import { asyncHandler, ok, notFound } from "@/utils/http";
import { approveInvoice } from "@/models/invoiceModel";

export const PATCH = asyncHandler(async (request, { params }) => {
  const { invoiceNo } = await params;
  const invoice = await approveInvoice(invoiceNo);
  if (!invoice) {
    return notFound("Invoice not found.");
  }
  return ok({ message: "Invoice approved.", invoice });
});
