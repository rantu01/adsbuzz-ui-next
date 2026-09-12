import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString } from "@/utils/validate";
import {
  updateFundTransaction,
  deleteFundTransaction,
} from "@/models/officeExpenseFundModel";
import { getRequestActor } from "@/utils/auditActor";

export const PUT = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const amount = Number(body.amount);
  const note = body.note === undefined ? undefined : optionalString(body.note, 500);
  const editNote = optionalString(body.editNote ?? body.note_reason ?? body.reason ?? "", 500);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Amount must be a positive number.");
  }

  try {
    const actor = (await getRequestActor(request)) || body.actor || body.editedBy || null;
    const { fund, transaction } = await updateFundTransaction(id, { amount, note, editNote, actor });
    return ok({ message: "Ad money entry updated.", fund, transaction });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(err.message);
    if (err.code === "INVALID_AMOUNT" || err.code === "NOT_EDITABLE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    if (err.code === "INSUFFICIENT_BALANCE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    throw err;
  }
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const amount = Number(body.amount);
  const note = body.note === undefined ? undefined : optionalString(body.note, 500);
  const editNote = optionalString(body.editNote ?? body.note_reason ?? body.reason ?? "", 500);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Amount must be a positive number.");
  }

  try {
    const actor = (await getRequestActor(request)) || body.actor || body.editedBy || null;
    const { fund, transaction } = await updateFundTransaction(id, { amount, note, editNote, actor });
    return ok({ message: "Ad money entry updated.", fund, transaction });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(err.message);
    if (err.code === "INVALID_AMOUNT" || err.code === "NOT_EDITABLE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    if (err.code === "INSUFFICIENT_BALANCE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    throw err;
  }
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  try {
    const { fund, transaction } = await deleteFundTransaction(id);
    return ok({ message: "Ad money entry deleted.", fund, transaction });
  } catch (err) {
    if (err.code === "NOT_FOUND") return notFound(err.message);
    if (err.code === "NOT_EDITABLE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    if (err.code === "INSUFFICIENT_BALANCE") {
      throw new ApiError(HttpStatus.BAD_REQUEST, err.message);
    }
    throw err;
  }
});
