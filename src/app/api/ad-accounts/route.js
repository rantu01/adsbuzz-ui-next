import { asyncHandler, ok, badRequest } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { listAdAccounts, createAdAccount } from "@/models/adAccountModel";
import { getPagination, paginate } from "@/utils/pagination";

export const GET = asyncHandler(async (request) => {
  const searchParams = new URL(request.url).searchParams;
  const accounts = await listAdAccounts();
  const p = paginate(accounts, getPagination(searchParams, { page: 1, limit: 50 }));
  return ok({ adAccounts: p.data, total: p.total, page: p.page, limit: p.limit, totalPages: p.totalPages });
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