import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import { listSaleSetups, createSaleSetup } from "@/models/saleSetupModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const setups = await listSaleSetups({
    search: searchParams.get("search") || "",
  });
  return ok({ setups, total: setups.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const groupId = optionalString(body.groupId, 100);
  if (!groupId) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "groupId is required.");
  }

  try {
    const setup = await createSaleSetup(body);
    return ok({ message: "Sale setup created.", setup }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "DUPLICATE") {
      throw new ApiError(HttpStatus.CONFLICT, "A setup for this group and ad account already exists.");
    }
    if (err.message === "ACCOUNT_REQUIRED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "An ad account is required for Ad Account Sales Setup.");
    }
    if (err.message === "DETAILS_REQUIRED") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Service details are required for Others Sale Setup.");
    }
    throw err;
  }
});
