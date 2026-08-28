import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import {
  listRefunds,
  createRefund,
  getRefundSummary,
} from "@/models/refundModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const [refunds, summary] = await Promise.all([
    listRefunds({ search }),
    getRefundSummary(),
  ]);
  return ok({ refunds, total: refunds.length, summary });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const date = optionalString(body.date, 20);
  const groupId = optionalString(body.groupId, 100);
  const adAccountName = optionalString(body.adAccountName, 200);
  const adAccountId = optionalString(body.adAccountId, 200);
  const paymentMethod = optionalString(body.paymentMethod, 100);
  const note = optionalString(body.note, 500);

  try {
    const refund = await createRefund({
      date,
      groupId,
      adAccountName,
      adAccountId,
      dollarRate: body.dollarRate,
      remainingDollar: body.remainingDollar,
      paymentMethod,
      note,
    });
    return ok({ message: "Refund recorded.", refund }, HttpStatus.CREATED);
  } catch (err) {
    switch (err.message) {
      case "GROUP_ID_REQUIRED":
        throw new ApiError(HttpStatus.BAD_REQUEST, "Group ID is required.");
      case "AD_ACCOUNT_NAME_REQUIRED":
        throw new ApiError(HttpStatus.BAD_REQUEST, "Ad Account Name is required.");
      case "AD_ACCOUNT_ID_REQUIRED":
        throw new ApiError(HttpStatus.BAD_REQUEST, "Ad Account ID is required.");
      case "DOLLAR_RATE_INVALID":
        throw new ApiError(HttpStatus.BAD_REQUEST, "Dollar Rate must be greater than 0.");
      case "PAYMENT_METHOD_REQUIRED":
        throw new ApiError(HttpStatus.BAD_REQUEST, "Refund Method is required.");
      case "NOTE_REQUIRED":
        throw new ApiError(HttpStatus.BAD_REQUEST, "Note is required.");
      default:
        throw err;
    }
  }
});
