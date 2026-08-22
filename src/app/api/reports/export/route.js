import { ApiError, HttpStatus, asyncHandler } from "@/utils/http";
import { getExportRows, renderCSV, renderXLSXHtml } from "@/models/reportModel";
import { generateReportPdf } from "@/lib/pdfReport";

const FORMATS = ["csv", "xlsx", "pdf"];

export const GET = asyncHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || "";
  const format = (searchParams.get("format") || "csv").toLowerCase();

  if (!FORMATS.includes(format)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, `format must be one of: ${FORMATS.join(", ")}`);
  }

  const report = await getExportRows(month);
  const filename = `AdsBuzz_Ledger_Statements_${report.month.replace("-", "")}`;

  if (format === "csv") {
    return new Response(renderCSV(report.ledger), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    return new Response(renderXLSXHtml(report), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.xls"`,
      },
    });
  }

  const pdfBuffer = await generateReportPdf(report);
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}.pdf"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
});