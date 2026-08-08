import { asyncHandler, ok, badRequest } from "@/utils/http";
import { readJsonBody, optionalString, requireEnum } from "@/utils/validate";
import { listAdAccounts, createAdAccount } from "@/models/adAccountModel";
import { getPagination, paginate } from "@/utils/pagination";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/ad-accounts";

const PLATFORMS = ["Facebook", "Google", "TikTok", "Snapchat"];
const ACCOUNT_STATUSES = ["Active", "Disabled", "Pending", "Sold", "Available", "Disable", "Need Support", "Terminated"];

export const GET = asyncHandler(async (request) => {
  const key = `${CACHE_PREFIX}:${request.url}`;
  const cached = cacheGet(key);
  if (cached) {
    return ok(cached);
  }

  const searchParams = new URL(request.url).searchParams;
  const accounts = await listAdAccounts();
  const p = paginate(accounts, getPagination(searchParams, { page: 1, limit: 50 }));
  const payload = { adAccounts: p.data, total: p.total, page: p.page, limit: p.limit, totalPages: p.totalPages };
  cacheSet(key, payload);
  return ok(payload);
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const adAccountId = optionalString(body.adAccountId, 200);
  const adAccountName = optionalString(body.adAccountName, 200);
  const adminId = optionalString(body.adminId, 200);
  const bmId = optionalString(body.bmId, 200);
  const bmName = optionalString(body.bmName, 200);
  const seriesId = optionalString(body.seriesId, 200);
  const selectCard = optionalString(body.selectCard, 200);
  const billingCard = optionalString(body.billingCard, 200);
  const platform = optionalString(body.platform, 50);
  const accountStatus = optionalString(body.accountStatus, 50);

  if (!adAccountId && !adAccountName) {
    return badRequest("Ad Account ID or Name is required.");
  }
  if (platform) requireEnum(platform, PLATFORMS, "platform");
  if (accountStatus) requireEnum(accountStatus, ACCOUNT_STATUSES, "accountStatus");

  const payload = {
    ...body,
    adAccountId: adAccountId || adAccountName,
    adAccountName: adAccountName || adAccountId,
    platform,
    seriesId,
    adminId,
    bmName,
    bmId,
    selectCard: selectCard || billingCard,
    billingCard: billingCard || selectCard,
    accountStatus,
  };

  const adAccount = await createAdAccount(payload);

  cacheInvalidate(CACHE_PREFIX);

  return ok({ message: "Ad account created.", adAccount }, 201);
});