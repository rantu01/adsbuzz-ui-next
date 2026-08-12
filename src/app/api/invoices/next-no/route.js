import { asyncHandler, ok } from "@/utils/http";
import { peekNextInvoiceNo } from "@/models/invoiceModel";

// Static route — takes precedence over /api/invoices/[invoiceNo].
export const GET = asyncHandler(async () => {
  const invoiceNo = await peekNextInvoiceNo();
  return ok({ invoiceNo });
});