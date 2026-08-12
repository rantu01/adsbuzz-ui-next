import { asyncHandler, ok } from "@/utils/http";
import { listTopups, AUDIT_ACTIVE_STATES } from "@/models/invoiceModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const onlyPending = searchParams.get("scope") === "pending";
  const topups = await listTopups({
    search: searchParams.get("search") || "",
    onlyPending,
  });
  const pending = topups.filter(
    (inv) => AUDIT_ACTIVE_STATES.includes(inv.approvalStatus) || inv.topupStatus === "Pending"
  ).length;
  return ok({ topups, total: topups.length, pending });
});