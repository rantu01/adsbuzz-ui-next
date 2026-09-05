import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import {
  getFund,
  addFunds,
  listFundTransactions,
} from "@/models/officeExpenseFundModel";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const fund = await getFund();
  const transactions = await listFundTransactions({
    limit: Number(searchParams.get("limit")) || 100,
  });
  return ok({ fund, transactions, total: transactions.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const amount = Number(body.amount);
  const note = optionalString(body.note, 500);
  const month = optionalString(body.month, 20);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Amount must be a positive number.");
  }

  try {
    const fund = await addFunds({ amount, note, month });
    return ok({ message: "Office expense balance funded.", fund }, HttpStatus.CREATED);
  } catch (err) {
    if (err.code === "INVALID_AMOUNT") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    throw err;
  }
});
