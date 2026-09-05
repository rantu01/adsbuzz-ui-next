import PDFDocument from "pdfkit";
import { ApiError, HttpStatus, asyncHandler } from "@/utils/http";
import { readJsonBody } from "@/utils/validate";

export const dynamic = "force-dynamic";

const BRAND = "#E05305";
const DARK = "#1e293b";
const MUTED = "#64748b";
const LIGHT = "#e5e7eb";

function fmtBDT(v) {
  return `BDT ${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function str(v) {
  return String(v ?? "").trim();
}

/**
 * Builds a PDF invoice for an Other Services sale draft. This endpoint serves
 * ONLY Other Services sales (serviceType must be "Others") and is never used
 * by the Ad Account Topup flow, so existing invoice functionality is untouched.
 */
function generateOthersServiceInvoicePdf(data) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, bottom: 40, left: 40, right: 40 },
      bufferPages: true,
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ---------- Brand header ----------
    doc.font("Helvetica-Bold").fontSize(18).fillColor(BRAND).text("Adsbuzz LLC", { align: "left" });
    doc.font("Helvetica").fontSize(10).fillColor(MUTED)
      .text("Biswas Betka, Atpukurpar, Tangail Sadar, Tangail -1900", { align: "left" })
      .text("Hotline- 01950151501", { align: "left" });
    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").fontSize(13).fillColor(DARK).text("Service Invoice (Other Services)", { align: "left" });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(`Generated: ${new Date().toLocaleString("en-US")}`, { align: "left" });
    doc.moveDown(0.6);
    doc.moveTo(left, doc.y)
      .lineTo(left + contentWidth, doc.y)
      .lineWidth(2).strokeColor(BRAND).stroke();
    doc.moveDown(1);

    // ---------- Invoice meta ----------
    const meta = [
      ["Invoice No", str(data.invoiceNo) || "—"],
      ["Date", str(data.date) || new Date().toISOString().split("T")[0]],
      ["Group ID", str(data.groupId) || "—"],
      ["Billed To", str(data.customerName) || "—"],
      ["Company", str(data.companyName) || "—"],
      ["Customer ID", str(data.customerId) || "—"],
    ];
    doc.font("Helvetica").fontSize(10);
    for (const [label, value] of meta) {
      const y = doc.y;
      const labelH = doc.heightOfString(label, { width: 112 });
      const valueH = doc.heightOfString(value, { width: contentWidth - 120 });
      const rowH = Math.max(labelH, valueH) + 2;
      doc.fillColor(MUTED).text(label, left, y + 1, { width: 112 });
      doc.fillColor(DARK).font("Helvetica-Bold")
        .text(value, left + 120, y + 1, { width: contentWidth - 120 });
      doc.font("Helvetica");
      doc.y = y + rowH;
    }
    doc.moveDown(0.6);
    doc.moveTo(left, doc.y)
      .lineTo(left + contentWidth, doc.y)
      .lineWidth(1).strokeColor(LIGHT).stroke();
    doc.moveDown(0.8);

    // ---------- Service ----------
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text("Service", { align: "left" });
    doc.moveDown(0.4);
    const serviceRows = [
      ["Service", str(data.service) || "—"],
      ["Service Details", str(data.serviceDetails) || "—"],
      ["Service Fee", fmtBDT(data.serviceFee)],
    ];
    doc.font("Helvetica").fontSize(10);
    for (const [label, value] of serviceRows) {
      const y = doc.y;
      const labelH = doc.heightOfString(label, { width: 142 });
      const valueH = doc.heightOfString(value, { width: contentWidth - 150 });
      const rowH = Math.max(labelH, valueH) + 2;
      doc.fillColor(MUTED).text(label, left, y + 1, { width: 142 });
      doc.fillColor(DARK).font("Helvetica-Bold")
        .text(value, left + 150, y + 1, { width: contentWidth - 150 });
      doc.font("Helvetica");
      doc.y = y + rowH;
    }
    doc.moveDown(0.6);
    doc.moveTo(left, doc.y)
      .lineTo(left + contentWidth, doc.y)
      .lineWidth(1).strokeColor(LIGHT).stroke();
    doc.moveDown(0.8);

    // ---------- Amounts ----------
    doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text("Payment", { align: "left" });
    doc.moveDown(0.4);
    const paymentRows = [
      ["Total Amount", fmtBDT(data.totalAmountBDT)],
      ["Paid Amount", fmtBDT(data.paidAmountBDT)],
      ["Due Amount", fmtBDT(data.dueAmountBDT)],
      ["Payment Status", str(data.paymentStatus) || "—"],
      ["Payment Channel", str(data.paymentMethod) || "—"],
      ["Working Status", str(data.workingStatus) || "—"],
      ["Assign Employee", str(data.assignEmployee) || "Not assigned"],
    ];
    doc.font("Helvetica").fontSize(10);
    for (const [label, value] of paymentRows) {
      const y = doc.y;
      const labelH = doc.heightOfString(label, { width: 142 });
      const valueH = doc.heightOfString(value, { width: contentWidth - 150 });
      const rowH = Math.max(labelH, valueH) + 2;
      doc.fillColor(MUTED).text(label, left, y + 1, { width: 142 });
      doc.fillColor(DARK).font("Helvetica-Bold")
        .text(value, left + 150, y + 1, { width: contentWidth - 150 });
      doc.font("Helvetica");
      doc.y = y + rowH;
    }

    if (str(data.note)) {
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(DARK).text("Note", { align: "left" });
      doc.moveDown(0.2);
      doc.font("Helvetica-Oblique").fontSize(10).fillColor(DARK)
        .text(str(data.note), { align: "left" });
    }

    doc.end();
  });
}

export const POST = asyncHandler(async (request) => {
  const body = await readJsonBody(request);

  // This invoice endpoint is exclusively for Other Services sales.
  if (body?.serviceType !== "Others") {
    throw new ApiError(HttpStatus.BAD_REQUEST, "This invoice download is only available for Other Services sales.");
  }

  const payload = {
    invoiceNo: str(body.invoiceNo),
    date: str(body.date) || new Date().toISOString().split("T")[0],
    groupId: str(body.groupId),
    customerId: str(body.customerId),
    customerName: str(body.customerName),
    companyName: str(body.companyName),
    service: str(body.service),
    serviceDetails: str(body.serviceDetails),
    serviceFee: Number(body.serviceFee) || 0,
    totalAmountBDT: Number(body.totalAmountBDT) || 0,
    paidAmountBDT: Number(body.paidAmountBDT) || 0,
    dueAmountBDT: Number(body.dueAmountBDT ?? (Number(body.totalAmountBDT) || 0) - (Number(body.paidAmountBDT) || 0)) || 0,
    paymentStatus: str(body.paymentStatus),
    paymentMethod: str(body.paymentMethod),
    workingStatus: str(body.workingStatus),
    assignEmployee: str(body.assignEmployee),
    note: str(body.note),
  };

  const pdfBuffer = await generateOthersServiceInvoicePdf(payload);
  const safeInv = (payload.invoiceNo || "draft").replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `AdsBuzz_Others_Invoice_${safeInv}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdfBuffer.length),
    },
  });
});
