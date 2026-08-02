import { asyncHandler, ok, notFound, badRequest } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { applyCardLoad } from "@/models/cardModel";

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  if (!body.cardName) {
    return badRequest("cardName is required.");
  }

  const amount = Number(body.topupAmountUSD);
  if (!(amount > 0)) {
    return badRequest("topupAmountUSD must be a positive number.");
  }

  const card = await applyCardLoad(String(body.cardName), amount);
  if (!card) {
    return notFound("Card not found.");
  }

  return ok({ message: "Card load applied.", card });
});