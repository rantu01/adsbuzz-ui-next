import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, requirePositiveNumber, optionalString } from "@/utils/validate";
import { createInvoice, queryInvoices, computeInvoiceAggregates } from "@/models/invoiceModel";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/cache";
import { getRequestActor } from "@/utils/auditActor";

const CACHE_PREFIX = "GET:/api/invoices";

// Hard upper bound so a bad/abusive `limit` can never pull the whole collection
// in one shot. `limit=0` is the explicit "give me everything" sentinel used only
// by the analytics pages (Reports/Insights/Customers/Topups/Dashboard) that
// still need the full ledger for cross-record math.
const MAX_PAGE_LIMIT = 200;

export const GET = asyncHandler(async (request) => {
  const key = `${CACHE_PREFIX}:${request.url}`;
  const cached = cacheGet(key);
  if (cached) {
    return ok(cached);
  }

  const { searchParams } = new URL(request.url);

  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const rawLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const limit = rawLimit === 0 ? 0 : Math.min(MAX_PAGE_LIMIT, Math.max(1, rawLimit || 20));

  const search = (searchParams.get("search") || "").trim();
  const paymentStatus = searchParams.get("paymentStatus") || "";
  const customerId = searchParams.get("customerId") || "";
  const adAccountId = searchParams.get("adAccountId") || "";

  // Build the Mongo filter once and let the database do the filtering,
  // counting, and slicing. This keeps the API payload tiny (one page) and the
  // DB load minimal (index-backed count + a bounded find).
  const filter = {};
  if (paymentStatus && paymentStatus !== "All") filter.paymentStatus = paymentStatus;
  if (customerId) filter.customerId = customerId;
  if (adAccountId) filter.adAccountId = adAccountId;
  if (search) {
    const q = search.toLowerCase();
    filter.$or = [
      { invoiceNo: { $regex: q, $options: "i" } },
      { adAccountName: { $regex: q, $options: "i" } },
      { groupId: { $regex: q, $options: "i" } },
      { customerId: { $regex: q, $options: "i" } },
      { note: { $regex: q, $options: "i" } },
    ];
  }

  // The page slice (filtered + paginated) and the collection-wide aggregates
  // (unfiltered, for the summary cards) are fetched in parallel.
  const [pageResult, aggregates] = await Promise.all([
    queryInvoices({ filter, page, limit }),
    computeInvoiceAggregates(),
  ]);

  const payload = {
    invoices: pageResult.items,
    total: pageResult.total,
    page: pageResult.page,
    limit: pageResult.limit,
    totalPages: pageResult.totalPages,
    aggregates,
  };
  cacheSet(key, payload);
  return ok(payload);
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const customerId = optionalString(body.customerId, 100);
  const isOthers = body.serviceType === "Others";
  const topupAmountUSD = isOthers || body.topupAmountUSD === undefined
    ? null
    : requirePositiveNumber(body.topupAmountUSD, "topupAmountUSD");
  if (isOthers) requirePositiveNumber(body.totalAmountBDT, "totalAmountBDT");

  if (!customerId) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "customerId is required.");
  }
  if (!isOthers && topupAmountUSD === null) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "topupAmountUSD is required.");
  }
  if (isOthers && !["Assigned", "In Progress"].includes(body.workingStatus)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "workingStatus must be Assigned or In Progress for Others sales.");
  }
  if (!isOthers && !optionalString(body.adAccountId, 200)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "adAccountId is required for Ad Account Topup sales.");
  }

  // Paid-amount rule: when no money is taken (paid amount empty/zero) the
  // screenshot is not required but an author note MUST be recorded explaining
  // the outstanding amount.
  const paidAmountBDT = Number(body.paidAmountBDT || 0);
  if (!(paidAmountBDT > 0) && !optionalString(body.note, 1000)) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      "Author Note is required when no amount is paid (Paid Amount is empty or 0)."
    );
  }

  try {
    const actor = await getRequestActor(request);
    const invoice = await createInvoice({ ...body, auditActor: actor });
    cacheInvalidate(CACHE_PREFIX);
    // Topup totals shown on the Sales page change whenever a sale is created.
    cacheInvalidate("GET:/api/customers");
    return ok(
      {
        message: "Sale executed. Invoice created.",
        invoice,
      },
      HttpStatus.CREATED
    );
  } catch (err) {
    if (err.message === "INVALID_RATE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid dollar rate.");
    }
    throw err;
  }
});
