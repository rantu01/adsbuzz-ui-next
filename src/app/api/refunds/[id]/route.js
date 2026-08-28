import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import {
  getRefundById,
  updateRefund,
  deleteRefund,
} from "@/models/refundModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const refund = await getRefundById(id);
  if (!refund) return notFound("Refund record not found.");
  return ok({ refund });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getRefundById(id);
  if (!existing) return notFound("Refund record not found.");

  const refund = await updateRefund(id, body);
  return ok({ message: "Refund updated.", refund });
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const existing = await getRefundById(id);
  if (!existing) return notFound("Refund record not found.");

  const refund = await deleteRefund(id);
  return ok({ message: "Refund deleted.", refund });
});
