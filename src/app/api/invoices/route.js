import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, requirePositiveNumber, optionalString } from "@/utils/validate";
import { listInvoices, createInvoice } from "@/models/invoiceModel";
import { getPagination, paginate } from "@/utils/pagination";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/invoices";

export const GET = asyncHandler(async (request) => {
  const key = `${CACHE_PREFIX}:${request.url}`;
  const cached = cacheGet(key);
  if (cached) {
    return ok(cached);
  }

  const { searchParams } = new URL(request.url);
  const invoices = await listInvoices({
    search: searchParams.get("search") || "",
    paymentStatus: searchParams.get("paymentStatus") || "",
    customerId: searchParams.get("customerId") || "",
  });
  const p = paginate(invoices, getPagination(searchParams, { page: 1, limit: 50 }));
  const payload = { invoices: p.data, total: p.total, page: p.page, limit: p.limit, totalPages: p.totalPages };
  cacheSet(key, payload);
  return ok(payload);
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const customerId = optionalString(body.customerId, 100);
  const topupAmountUSD = body.topupAmountUSD === undefined
    ? null
    : requirePositiveNumber(body.topupAmountUSD, "topupAmountUSD");

  if (!customerId) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "customerId is required.");
  }
  if (topupAmountUSD === null) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "topupAmountUSD is required.");
  }
  if (body.serviceType !== "Others" && !optionalString(body.adAccountId, 200)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "adAccountId is required for Ad Account Topup sales.");
  }

  try {
    const invoice = await createInvoice(body);
    cacheInvalidate(CACHE_PREFIX);
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
