import { asyncHandler, ok, notFound } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getCardById, updateCard, toggleCardStatus, deleteCard } from "@/models/cardModel";

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

  const card = body.statusOnly
    ? await toggleCardStatus(id)
    : await updateCard(id, body);

  if (!card) {
    return notFound("Card not found.");
  }
  return ok({ message: "Card updated.", card });
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const existing = await getCardById(id);
  if (!existing) {
    return notFound("Card not found.");
  }

  await deleteCard(id);
  return ok({ message: "Card deleted.", card: existing });
});