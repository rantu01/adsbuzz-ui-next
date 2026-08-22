import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, requirePositiveNumber, optionalString } from "@/utils/validate";
import { getInvoiceByNo, recordInvoicePayment } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";
import { cacheInvalidate } from "@/lib/cache";

export const dynamic = "force-dynamic";

/**
 * POST /api/invoices/:invoiceNo/pay
 * Records a BDT payment against an invoice that still has a due balance.
 * Recomputes Paid Amount / Due Amount / Payment Status and appends a
 * `payment_received` entry to the invoice's activity log (who + when + amount).
 */
export const POST = asyncHandler(async (request, { params }) => {
  const { invoiceNo } = await params;
  const body = await readJsonBody(request);

  const existing = await getInvoiceByNo(invoiceNo);
  if (!existing) {
    return notFound("Invoice not found.");
  }

  const amountBDT = requirePositiveNumber(body.amountBDT, "amountBDT");
  const paymentMethod = optionalString(body.paymentMethod, 200);
  const date = optionalString(body.date, 20);
  const transactionId = optionalString(body.transactionId, 200);
  const note = optionalString(body.note, 1000);

  try {
    const actor = await getRequestActor(request);
    const invoice = await recordInvoicePayment(invoiceNo, {
      amountBDT,
      paymentMethod,
      date,
      transactionId,
      note,
      screenshot: body.screenshot || "",
      actor,
    });
    if (!invoice) {
      return notFound("Invoice not found.");
    }
    cacheInvalidate("GET:/api/invoices");
    cacheInvalidate("GET:/api/customers");
    cacheInvalidate("GET:/api/dashboard");
    return ok(
      {
        message: `Payment of ৳${amountBDT.toLocaleString()} recorded against invoice ${invoiceNo}.`,
        invoice,
      },
      HttpStatus.CREATED
    );
  } catch (err) {
    if (err.code === "INVALID_PAYMENT_AMOUNT" || err.code === "INVOICE_FULLY_PAID" || err.code === "PAYMENT_EXCEEDS_DUE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    throw err;
  }
});