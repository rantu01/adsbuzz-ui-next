import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aggregateTopClientCurrentMonth } from '@/models/invoiceModel';

const MONTH = '2026-09';
const customers = [
  { id: 'ADB550001', name: 'Alpha Corp', groupId: 'GC-ALPHA' },
  { id: 'ADB550002', name: 'Beta Ltd', groupId: 'GC-BETA' },
];

test('picks the customer with the highest current-month total', () => {
  const invoices = [
    { customerId: 'ADB550001', groupId: 'GC-ALPHA', date: '2026-09-03', topupAmountUSD: 100 },
    { customerId: 'ADB550001', groupId: 'GC-ALPHA', date: '2026-09-20', topupAmountUSD: 150 },
    { customerId: 'ADB550002', groupId: 'GC-BETA', date: '2026-09-10', topupAmountUSD: 500 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  assert.equal(result.month, MONTH);
  assert.deepEqual(result.topClient, {
    customerId: 'ADB550002',
    name: 'Beta Ltd',
    groupId: 'GC-BETA',
    totalTopupUSD: 500,
  });
  assert.equal(result.totalTopupUSD, 500);
});

test('excludes invoices from other months', () => {
  const invoices = [
    { customerId: 'ADB550001', date: '2026-08-31', topupAmountUSD: 9999 },
    { customerId: 'ADB550001', date: '2026-09-01', topupAmountUSD: 40 },
    { customerId: 'ADB550002', date: '2026-10-01', topupAmountUSD: 9999 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  assert.equal(result.topClient.customerId, 'ADB550001');
  assert.equal(result.totalTopupUSD, 40);
});

test('counts Date-instance dates and createdAtRaw fallbacks', () => {
  const invoices = [
    { customerId: 'ADB550001', date: new Date('2026-09-12T10:00:00Z'), topupAmountUSD: 70 },
    { customerId: 'ADB550002', date: '', createdAtRaw: new Date('2026-09-15T10:00:00Z'), topupAmountUSD: 90 },
    { customerId: 'ADB550001', date: '', createdAtRaw: new Date('2026-08-15T10:00:00Z'), topupAmountUSD: 5000 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  assert.equal(result.topClient.customerId, 'ADB550002');
  assert.equal(result.totalTopupUSD, 90);
});

test('coerces string amounts instead of concatenating them', () => {
  const invoices = [
    { customerId: 'ADB550001', date: '2026-09-02', topupAmountUSD: '250' },
    { customerId: 'ADB550001', date: '2026-09-03', topupAmountUSD: 100 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  assert.equal(result.totalTopupUSD, 350);
});

test('treats missing/invalid amounts as zero', () => {
  const invoices = [
    { customerId: 'ADB550001', date: '2026-09-02', topupAmountUSD: undefined },
    { customerId: 'ADB550001', date: '2026-09-03', topupAmountUSD: 'not-a-number' },
    { customerId: 'ADB550002', date: '2026-09-04', topupAmountUSD: 10 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  assert.equal(result.topClient.customerId, 'ADB550002');
  assert.equal(result.totalTopupUSD, 10);
});

test('merges legacy customer ids with canonical ids', () => {
  const invoices = [
    { customerId: 'CUST-1', date: '2026-09-02', topupAmountUSD: 120 },
    { customerId: 'ADB550001', date: '2026-09-03', topupAmountUSD: 130 },
    { customerId: 'ADB550002', date: '2026-09-04', topupAmountUSD: 200 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  // CUST-1 normalizes to ADB550001, so Alpha totals 250 and wins.
  assert.equal(result.topClient.customerId, 'ADB550001');
  assert.equal(result.topClient.name, 'Alpha Corp');
  assert.equal(result.topClient.groupId, 'GC-ALPHA');
  assert.equal(result.totalTopupUSD, 250);
});

test('breaks ties deterministically by ascending customer id', () => {
  const invoices = [
    { customerId: 'ADB550002', date: '2026-09-02', topupAmountUSD: 300 },
    { customerId: 'ADB550001', date: '2026-09-03', topupAmountUSD: 300 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  assert.equal(result.topClient.customerId, 'ADB550001');
  assert.equal(result.totalTopupUSD, 300);
});

test('rounds totals to 2 decimals', () => {
  const invoices = [
    { customerId: 'ADB550001', date: '2026-09-02', topupAmountUSD: 0.1 },
    { customerId: 'ADB550001', date: '2026-09-03', topupAmountUSD: 0.2 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  assert.equal(result.totalTopupUSD, 0.3);
});

test('falls back to invoice data when the customer record is missing', () => {
  const invoices = [
    { customerId: 'ADB559999', groupId: 'GC-GHOST', date: '2026-09-02', topupAmountUSD: 75 },
  ];
  const result = aggregateTopClientCurrentMonth(invoices, customers, MONTH);
  assert.equal(result.topClient.customerId, 'ADB559999');
  assert.equal(result.topClient.name, 'ADB559999');
  assert.equal(result.topClient.groupId, 'GC-GHOST');
  assert.equal(result.totalTopupUSD, 75);
});

test('returns null when the month has no attributable topups', () => {
  assert.deepEqual(aggregateTopClientCurrentMonth([], customers, MONTH), {
    month: MONTH,
    topClient: null,
    totalTopupUSD: 0,
  });
  // Rows without a customer id cannot be attributed to anyone.
  const orphan = [{ customerId: '', date: '2026-09-02', topupAmountUSD: 999 }];
  assert.deepEqual(aggregateTopClientCurrentMonth(orphan, customers, MONTH), {
    month: MONTH,
    topClient: null,
    totalTopupUSD: 0,
  });
  // Empty month prefix never matches.
  const invoices = [{ customerId: 'ADB550001', date: '2026-09-02', topupAmountUSD: 50 }];
  assert.deepEqual(aggregateTopClientCurrentMonth(invoices, customers, ''), {
    month: '',
    topClient: null,
    totalTopupUSD: 0,
  });
});
