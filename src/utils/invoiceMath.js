// Pure, dependency-free invoice calculation helpers.
// Shared by the backend model (`invoiceModel.js`) and the unit tests.

export function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().split("T")[0];
}

export function detectPlatform(accountName = "") {
  const name = String(accountName).toUpperCase();
  if (name.includes("ATA")) return "TikTok";
  if (name.includes("ADG")) return "Google";
  if (name.includes("AD_") || name.includes("ADF_") || name.includes("ADS_")) return "Facebook";
  return "Facebook";
}

export function computePaymentStatus({ totalAmountBDT = 0, paidAmountBDT = 0, dueAmountBDT = 0 } = {}) {
  const total = Number(totalAmountBDT) || 0;
  const paid = Number(paidAmountBDT) || 0;
  const due = Number(dueAmountBDT) || 0;

  if (total <= 0) return "Paid";
  if (due <= 0 && paid > 0) return "Paid";
  if (paid > 0 && paid < total) return "Partially Paid";
  return "Due";
}

/**
 * Applies an incoming BDT payment to an invoice's running totals.
 * Returns the new paid amount, due amount, and derived payment status.
 * Used by both the backend (`recordInvoicePayment`) and the UI payment form.
 */
export function applyPayment({ totalAmountBDT = 0, paidAmountBDT = 0, dueAmountBDT = 0, amountBDT = 0 } = {}) {
  const total = round2(Number(totalAmountBDT) || 0);
  const paid = round2(Number(paidAmountBDT) || 0);
  const due = round2(Number(dueAmountBDT) || 0);
  const amount = round2(Number(amountBDT) || 0);

  const nextPaid = round2(Math.min(total, Math.max(0, paid + amount)));
  const nextDue = round2(Math.max(0, total - nextPaid));

  return {
    paidAmountBDT: nextPaid,
    dueAmountBDT: nextDue,
    paymentStatus: computePaymentStatus({ totalAmountBDT: total, paidAmountBDT: nextPaid, dueAmountBDT: nextDue }),
  };
}

export function invoiceNoFromLegacyId(legacyId) {
  const hex = String(legacyId).replace(/[^0-9a-f]/gi, "").slice(-6) || "0";
  const num = parseInt(hex, 16) % 1000000;
  return `ADB ${String(num).padStart(6, "0")}`;
}
