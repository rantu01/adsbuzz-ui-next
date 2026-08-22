import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { listCards, createCard } from "@/models/cardModel";
import { getPagination, paginate } from "@/utils/pagination";

export const GET = asyncHandler(async (request) => {
  const searchParams = new URL(request.url).searchParams;
  const cards = await listCards();
  const p = paginate(cards, getPagination(searchParams, { page: 1, limit: 50 }));
  return ok({ cards: p.data, total: p.total, page: p.page, limit: p.limit, totalPages: p.totalPages });
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
    if (err.message === "INVALID_PLATFORM") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid platform selected.");
    }
    if (err.message === "INVALID_WALLET") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid wallet selected.");
    }
    if (err.message === "WALLET_PLATFORM_MISMATCH") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Selected wallet does not belong to the selected platform.");
    }
    throw err;
  }
});