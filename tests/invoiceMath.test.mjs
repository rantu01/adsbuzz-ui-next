import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  round2,
  dateOnly,
  detectPlatform,
  computePaymentStatus,
  invoiceNoFromLegacyId,
} from '@/utils/invoiceMath';

test('round2 rounds to 2 decimals with epsilon', () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(round2(132.3333), 132.33);
  assert.equal(round2(10), 10);
  assert.equal(round2(0.1 + 0.2), 0.3);
});

test('dateOnly normalizes dates to YYYY-MM-DD', () => {
  assert.equal(dateOnly('2025-04-10T10:00:00.000Z'), '2025-04-10');
  assert.equal(dateOnly(null), '');
  assert.equal(dateOnly(undefined), '');
  assert.equal(dateOnly('not-a-date'), 'not-a-date');
});

test('detectPlatform classifies by name prefix', () => {
  assert.equal(detectPlatform('ATA_Hasan_Mobile_112'), 'TikTok');
  assert.equal(detectPlatform('ADG_Media_Agency_7'), 'Google');
  assert.equal(detectPlatform('AD_Adsbuzz_Agency_612'), 'Facebook');
  assert.equal(detectPlatform('ADF_Brand_X'), 'Facebook');
  assert.equal(detectPlatform('ADS_Inventory_1'), 'Facebook');
  assert.equal(detectPlatform('Something Else'), 'Facebook');
});

test('computePaymentStatus derives status from amounts', () => {
  assert.equal(computePaymentStatus({ totalAmountBDT: 13200, paidAmountBDT: 13200, dueAmountBDT: 0 }), 'Paid');
  assert.equal(computePaymentStatus({ totalAmountBDT: 13200, paidAmountBDT: 5000, dueAmountBDT: 8200 }), 'Partially Paid');
  assert.equal(computePaymentStatus({ totalAmountBDT: 13200, paidAmountBDT: 0, dueAmountBDT: 13200 }), 'Due');
  assert.equal(computePaymentStatus({}), 'Paid');
});

test('invoiceNoFromLegacyId maps legacy ids to ADB numbers', () => {
  const out = invoiceNoFromLegacyId('645d8f0ab5c2a41f3e2d1c90');
  assert.match(out, /^ADB \d{6}$/);
  assert.equal(invoiceNoFromLegacyId(''), 'ADB 000000');
});
