import { asyncHandler, ok } from "@/utils/http";
import { getDashboardStats } from "@/models/dashboardModel";

export const dynamic = 'force-dynamic';

export const GET = asyncHandler(async () => {
  const dashboard = await getDashboardStats();
  return ok({ dashboard });
});