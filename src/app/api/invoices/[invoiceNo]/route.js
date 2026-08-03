import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, requirePositiveNumber } from "@/utils/validate";
import { getInvoiceByNo, updateInvoice } from "@/models/invoiceModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { invoiceNo } = await params;
  const invoice = await getInvoiceByNo(invoiceNo);
  if (!invoice) {
    return notFound("Invoice not found.");
  }
  return ok({ invoice });
});

export const PUT = asyncHandler(async (request, { params }) => {
  const { invoiceNo } = await params;
  const body = await readJsonBody(request);

  const existing = await getInvoiceByNo(invoiceNo);
  if (!existing) {
    return notFound("Invoice not found.");
  }

  if (body.topupAmountUSD !== undefined && Number(body.topupAmountUSD) <= 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "topupAmountUSD must be a positive number.");
  }

  const invoice = await updateInvoice(invoiceNo, body);
  return ok({ message: "Invoice updated.", invoice });
});
