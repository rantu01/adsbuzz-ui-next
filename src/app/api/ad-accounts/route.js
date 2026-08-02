import { asyncHandler, ok, badRequest } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { listAdAccounts, createAdAccount } from "@/models/adAccountModel";

export const GET = asyncHandler(async (request) => {
  const accounts = await listAdAccounts();
  return ok({ adAccounts: accounts, total: accounts.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const adAccountId = optionalString(body.adAccountId, 200);
  const adAccountName = optionalString(body.adAccountName, 200);

  if (!adAccountId && !adAccountName) {
    return badRequest("Ad Account ID or Name is required.");
  }

  const adAccount = await createAdAccount({
    ...body,
    adAccountId: adAccountId || adAccountName,
    adAccountName: adAccountName || adAccountId,
  });

  return ok({ message: "Ad account created.", adAccount }, 201);
});