import { asyncHandler, ok, badRequest, conflict } from "@/utils/http";
import { readJsonBody, optionalString, requireEnum } from "@/utils/validate";
import { listSocialAdAccounts, createSocialAdAccount, socialAdAccountExists } from "@/models/socialAdAccountModel";
import { listAdAccounts } from "@/models/adAccountModel";
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/cache";

const CACHE_PREFIX = "GET:/api/social-ad-accounts";
const PLATFORMS = ["Facebook", "Google", "TikTok", "Snapchat"];
const ACCOUNT_STATUSES = ["Active", "Disabled", "Pending", "Sold", "Available", "Disable", "Need Support", "Terminated"];

export const GET = asyncHandler(async (request) => {
  const key = `${CACHE_PREFIX}:${request.url}`;
  const cached = cacheGet(key);
  if (cached) {
    return ok(cached);
  }

  const accounts = await listSocialAdAccounts();
  const payload = { adAccounts: accounts, total: accounts.length, page: 1, limit: accounts.length, totalPages: 1 };
  cacheSet(key, payload);
  return ok(payload);
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const adAccountId = optionalString(body.adAccountId, 200);
  const adAccountName = optionalString(body.adAccountName, 200);
  const platform = optionalString(body.platform, 50);
  const accountStatus = optionalString(body.accountStatus, 50);

  if (!adAccountId && !adAccountName) {
    return badRequest("Ad Account ID or Name is required.");
  }
  if (platform) requireEnum(platform, PLATFORMS, "platform");
  if (accountStatus) requireEnum(accountStatus, ACCOUNT_STATUSES, "accountStatus");

  const rawId = (adAccountId || "").trim();

  // Cross-collection duplicate check: the same AD ACCOUNT ID must never exist
  // in the existing (legacy) ad accounts collection OR in the social ad accounts
  // collection. If it does, reject and tell the caller to use the existing account.
  if (rawId) {
    const existingMain = await listAdAccounts();
    const duplicateMain = existingMain.find((a) => (a.adAccountId || "").trim() === rawId);
    if (duplicateMain) {
      return conflict(
        `Ad Account ID ${rawId} already exists in the ad accounts inventory. Please edit the existing account instead of creating a duplicate.`,
      );
    }

    const duplicateSocial = await socialAdAccountExists(rawId);
    if (duplicateSocial) {
      return conflict(
        `Ad Account ID ${rawId} already exists in the Load Social Ad Account entries. Please edit the existing entry instead of creating a duplicate.`,
      );
    }
  }

  const payload = {
    ...body,
    adAccountId: adAccountId || adAccountName,
    adAccountName: adAccountName || adAccountId,
    platform,
    adminId: body.adminId,
    bmName: body.bmName,
    bmId: body.bmId,
    seriesId: body.seriesId,
    selectCard: body.selectCard || body.billingCard,
    billingCard: body.billingCard || body.selectCard,
    accountStatus,
    source: "social",
  };

  const adAccount = await createSocialAdAccount(payload);

  cacheInvalidate(CACHE_PREFIX);
  return ok({ message: "Social ad account created.", adAccount }, 201);
});
