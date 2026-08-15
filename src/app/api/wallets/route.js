import { asyncHandler, ok, ApiError, HttpStatus } from "@/utils/http";
import { readJsonBody, optionalString, normalizeEmail } from "@/utils/validate";
import { listWallets, createWallet } from "@/models/walletModel";

export const GET = asyncHandler(async (request) => {
  const wallets = await listWallets();
  return ok({ wallets, total: wallets.length });
});

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  const walletId = optionalString(body.walletId, 100);
  const ownerName = optionalString(body.ownerName, 200);
  const idCardInfo = optionalString(body.idCardInfo, 200);
  const sourceBy = optionalString(body.sourceBy, 200);
  const email = normalizeEmail(body.email);

  if (!ownerName) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Owner name is required.");
  }
  if (!idCardInfo) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "ID card info is required.");
  }
  if (!sourceBy) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Source by is required.");
  }
  if (!email) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "Email is required.");
  }

  try {
    const wallet = await createWallet({
      walletId,
      ownerName,
      idCardInfo,
      sourceBy,
      email,
      accountSecurityStatus: body.accountSecurityStatus,
      walletStatus: body.walletStatus,
    });
    return ok({ message: "Wallet created.", wallet }, HttpStatus.CREATED);
  } catch (err) {
    if (err.message === "DUPLICATE") {
      throw new ApiError(HttpStatus.CONFLICT, "A wallet with this code already exists.");
    }
    if (err.message === "DUPLICATE_EMAIL") {
      throw new ApiError(HttpStatus.CONFLICT, "A wallet with this email already exists.");
    }
    throw err;
  }
});
