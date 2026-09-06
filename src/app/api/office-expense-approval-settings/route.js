import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import {
  getOfficeExpenseApprovalSettings,
  updateOfficeExpenseApprovalSettings,
} from "@/models/officeExpenseEntryModel";

export const GET = asyncHandler(async () => {
  const settings = await getOfficeExpenseApprovalSettings();
  return ok({ settings });
});

export const PATCH = asyncHandler(async (request) => {
  const body = await readJsonBody(request);
  try {
    const settings = await updateOfficeExpenseApprovalSettings({
      requiredApprovals: body.requiredApprovals,
      approvers: body.approvers,
    });
    return ok({ message: "Approval settings updated.", settings });
  } catch (err) {
    if (err.message === "INVALID_REQUIRED_APPROVALS") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Required approvals must be a number between 1 and 10.");
    }
    throw err;
  }
});
