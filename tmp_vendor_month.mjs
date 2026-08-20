import { MongoClient } from "mongodb";

const c = new MongoClient("mongodb+srv://adsbuzz:eQwbPKISaavGzcfi@adsbuzz.vne2zqt.mongodb.net/?appName=Adsbuzz");
await c.connect();
const db = c.db("ad_buzz");

const vendors = await db.collection("vendors").find({}).toArray();
console.log("=== AUGUST (2026-08) VENDOR PAYMENTS ===");
for (const v of vendors) {
  for (const p of v.paymentHistory || []) {
    if ((p.date || "").startsWith("2026-08")) {
      console.log(`${v.id} | ${v.name} | type=${v.vendorType} | ${p.date} | BDT=${p.amountBDT} | ${p.paymentMethod}`);
    }
  }
}

console.log("\n=== JULY (2026-07) VENDOR PAYMENTS ===");
for (const v of vendors) {
  for (const p of v.paymentHistory || []) {
    if ((p.date || "").startsWith("2026-07")) {
      console.log(`${v.id} | ${v.name} | type=${v.vendorType} | ${p.date} | BDT=${p.amountBDT} | ${p.paymentMethod}`);
    }
  }
}

await c.close();