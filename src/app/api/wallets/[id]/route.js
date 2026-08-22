import { asyncHandler, ok, notFound, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";
import { getWalletById, updateWallet, deleteWallet } from "@/models/walletModel";

export const GET = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const wallet = await getWalletById(id);
  if (!wallet) {
    return notFound("Wallet not found.");
  }
  return ok({ wallet });
});

export const PATCH = asyncHandler(async (request, { params }) => {
  const { id } = await params;
  const body = await readJsonBody(request);

  const existing = await getWalletById(id);
  if (!existing) {
    return notFound("Wallet not found.");
  }

  try {
    const wallet = await updateWallet(id, body);
    return ok({ message: "Wallet updated.", wallet });
  } catch (err) {
    if (err.message === "INVALID_PLATFORM") {
      throw new ApiError(HttpStatus.BAD_REQUEST, "Invalid platform selected.");
    }
    throw err;
  }
});

export const DELETE = asyncHandler(async (request, { params }) => {
  const { id } = await params;

  const existing = await getWalletById(id);
  if (!existing) {
    return notFound("Wallet not found.");
  }

  const wallet = await deleteWallet(id);
  return ok({ message: "Wallet deleted.", wallet });
});
