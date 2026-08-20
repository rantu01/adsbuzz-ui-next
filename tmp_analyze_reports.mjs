import { MongoClient } from "mongodb";

const c = new MongoClient("mongodb+srv://adsbuzz:eQwbPKISaavGzcfi@adsbuzz.vne2zqt.mongodb.net/?appName=Adsbuzz");
await c.connect();
const db = c.db("ad_buzz");

const withPay = await db.collection("invoices").find({ payments: { $exists: true, $ne: [] } }).toArray();
console.log("invoices with payments array:", withPay.length);
if (withPay.length) console.log(JSON.stringify(withPay[0].payments, null, 1));

const vendors = await db.collection("vendors").find({}).toArray();
let noBDT = 0, withBDT = 0;
for (const v of vendors) for (const p of v.paymentHistory || []) { if (Number(p.amountBDT || 0) > 0) withBDT++; else noBDT++; }
console.log("vendor payments with amountBDT:", withBDT, "without:", noBDT);

const s = await db.collection("vendors").findOne({ id: "VEND-6464" });
console.log("SHAKIL sample payments:");
console.log(JSON.stringify((s.paymentHistory || []).slice(0, 5), null, 1));

const byMonth = {};
for (const v of vendors) for (const p of v.paymentHistory || []) {
  const m = (p.date || "").slice(0, 7);
  if (!m) continue;
  if (!byMonth[m]) byMonth[m] = { count: 0, bdt: 0 };
  byMonth[m].count++;
  byMonth[m].bdt += Number(p.amountBDT || 0);
}
console.log("vendor payments by month:", JSON.stringify(byMonth, null, 1));

// daily invoice breakdown for current data months
const invs = await db.collection("invoices").find({}).toArray();
const daily = {};
for (const i of invs) {
  const d = (i.date || "").slice(0, 10);
  if (!d) continue;
  if (!daily[d]) daily[d] = { count: 0, usd: 0, bdt: 0, paid: 0 };
  daily[d].count++;
  daily[d].usd += Number(i.topupAmountUSD || 0);
  daily[d].bdt += Number(i.totalAmountBDT || i.paidAmountBDT || 0);
  daily[d].paid += Number(i.paidAmountBDT || 0);
}
console.log("daily invoice breakdown (sample):");
const keys = Object.keys(daily).sort();
for (const k of keys) console.log(k, JSON.stringify(daily[k]));

await c.close();