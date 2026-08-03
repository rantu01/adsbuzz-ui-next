import { asyncHandler, ok } from "@/utils/http";
import { getInsights } from "@/models/insightsModel";

export const GET = asyncHandler(async () => {
  const insights = await getInsights();
  return ok({ insights });
});
