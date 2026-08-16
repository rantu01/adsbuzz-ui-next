import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { createHistoricalInvoice } from "@/models/invoiceModel";
import { getRequestActor } from "@/utils/auditActor";
import { cacheInvalidate } from "@/lib/cache";

export const dynamic = 'force-dynamic';

/**
 * POST /api/invoices/historical
 * Records a sale that happened BEFORE this system was in use. The entry is
 * persisted like any other invoice (so it shows up in Sales Entry Records /
 * history) but is created already "Approved" with no live side effects
 * (no account Sold, no card load, no customer credit change).
 */
export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const customerId = optionalString(body.customerId, 100);
  const topupAmountUSD = Number(body.topupAmountUSD);
  if (!customerId) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "customerId is required.");
  }
  if (!Number.isFinite(topupAmountUSD) || topupAmountUSD <= 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "topupAmountUSD must be a positive number.");
  }
  if (body.serviceType !== "Others" && !optionalString(body.adAccountId, 200)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "adAccountId is required for Ad Account Topup sales.");
  }
  const paidAmountBDT = Number(body.paidAmountBDT || 0);
  if (!(paidAmountBDT > 0) && !optionalString(body.note, 1000)) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "Author Note is required when no amount is paid (Paid Amount is empty or 0)."
    );
  }

  try {
    const actor = await getRequestActor(request);
    const invoice = await createHistoricalInvoice({ ...body, auditActor: actor });
    cacheInvalidate("GET:/api/invoices");
    cacheInvalidate("GET:/api/customers");
    return ok(
      {
        message: "Historical sale recorded. Invoice created.",
        invoice,
      },
      HttpStatus.CREATED
    );
  } catch (err) {
    if (err.code === "INVALID_HISTORICAL_DATE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    throw err;
  }
});
