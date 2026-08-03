import { asyncHandler, ok } from "@/utils/http";
import { listPendingTopups } from "@/models/invoiceModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const topups = await listPendingTopups({ search: searchParams.get("search") || "" });
  return ok({ topups, total: topups.length });
});
