import { ApiError, HttpStatus, asyncHandler } from "@/utils/http";
import { getAdAccountStatement } from "@/models/reportModel";
import { generateAdAccountStatementPdf } from "@/lib/pdfReport";

export const dynamic = "force-dynamic";

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const groupId = String(searchParams.get("groupId") || "").trim();
  const adAccount = String(searchParams.get("adAccount") || "").trim();

  if (!groupId) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "groupId is required");
  }
  if (!adAccount) {
    throw new ApiError(HttpStatus.BAD_REQUEST, "adAccount is required");
  }

  const statement = await getAdAccountStatement(groupId, adAccount);
  const pdfBuffer = await generateAdAccountStatementPdf(statement);

  const safeName = `${groupId}_${adAccount}`.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `AdsBuzz_Statement_${safeName}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
});
