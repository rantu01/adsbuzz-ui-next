import { asyncHandler, ok } from "@/utils/http";
import { listInvoices } from "@/models/invoiceModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const invoices = await listInvoices({
    search: searchParams.get("search") || "",
    paymentStatus: searchParams.get("paymentStatus") || "",
    customerId: searchParams.get("customerId") || "",
  });
  return ok({ invoices, total: invoices.length });
});
