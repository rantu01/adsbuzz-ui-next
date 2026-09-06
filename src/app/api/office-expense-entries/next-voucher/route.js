import { asyncHandler, ok } from "@/utils/http";
import { peekNextOfficeExpenseVoucherNo } from "@/models/officeExpenseEntryModel";

export const GET = asyncHandler(async () => {
  const voucherNo = await peekNextOfficeExpenseVoucherNo();
  return ok({ voucherNo });
});
