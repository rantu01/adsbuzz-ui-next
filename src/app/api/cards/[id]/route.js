import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
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

  if (card && typeof card === 'object' && card.error) {
    if (card.error === "INVALID_PLATFORM") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid platform selected.");
    }
    if (card.error === "INVALID_WALLET") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid wallet selected.");
    }
    if (card.error === "WALLET_PLATFORM_MISMATCH") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Selected wallet does not belong to the selected platform.");
    }
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