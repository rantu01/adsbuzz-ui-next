import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { listCards, createCard } from "@/models/cardModel";

export const GET = asyncHandler(async (request) => {
  const cards = await listCards();
  return ok({ cards, total: cards.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  if (!body.cardName) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Card display name is required.");
  }

  try {
    const card = await createCard(body);
    return ok({ message: "Card registered.", card }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "DUPLICATE") {
      throw new ApiError(HttpStatus.CONFLICT, "A card with this name already exists.");
    }
    throw err;
  }
});