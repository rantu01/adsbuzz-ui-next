import { asyncHandler, ok } from "@/utils/http";
import { getDashboardStats } from "@/models/dashboardModel";

export const GET = asyncHandler(async () => {
  const dashboard = await getDashboardStats();
  return ok({ dashboard });
});