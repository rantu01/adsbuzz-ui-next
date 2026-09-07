import { asyncHandler, ok } from "@/utils/http";
import { queryTopups } from "@/models/invoiceModel";

function firstParam(searchParams, names) {
  for (const name of names) {
    const value = searchParams.get(name);
    if (value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

/**
 * GET /api/topups?page=1&limit=20&search=&scope=pending
 * Server-side paginated audit queue. MongoDB applies filters/search/sort and
 * returns only the current page of lightweight rows plus indexed counts.
 * The `topups` key is kept so existing readers keep working; `items` is the
 * same page under its canonical name.
 */
export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const onlyPending = searchParams.get("scope") === "pending";

  const result = await queryTopups({
    search: firstParam(searchParams, ["search", "q"]),
    onlyPending,
    approvalStatus: firstParam(searchParams, ["approvalStatus", "approval"]),
    paymentStatus: firstParam(searchParams, ["paymentStatus", "payment"]),
    topupStatus: firstParam(searchParams, ["topupStatus", "topup"]),
    customerId: firstParam(searchParams, ["customerId", "customer"]),
    adAccount: firstParam(searchParams, ["adAccount", "account"]),
    date: firstParam(searchParams, ["date", "month"]),
    page: Number(searchParams.get("page")) || 1,
    limit: Number(searchParams.get("limit")) || 20,
  });

  return ok({
    topups: result.items,
    items: result.items,
    total: result.total,
    pending: result.pending,
    activeAudits: result.activeAudits,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  });
});
