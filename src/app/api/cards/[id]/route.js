import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getCardById, updateCard, toggleCardStatus } from "@/models/cardModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const card = await getCardById(id);
  if (!card) {
    return notFound("Card not found.");
  }
  return ok({ card });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getCardById(id);
  if (!existing) {
    return notFound("Card not found.");
  }

  if (body.statusOnly === true || (body.status && body.toggle === true)) {
    const card = await toggleCardStatus(id);
    return ok({ message: "Card status toggled.", card });
  }

  const card = await updateCard(id, body);
  return ok({ message: "Card updated.", card });
});