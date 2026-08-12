import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCustomerId,
  isValidCustomerId,
  normalizeCustomerId,
  CUSTOMER_ID_REGEX,
} from '@/utils/customerIds';

test('formatCustomerId produces canonical ADB ids', () => {
  assert.equal(formatCustomerId(0), 'ADB550000');
  assert.equal(formatCustomerId(1), 'ADB550001');
  assert.equal(formatCustomerId(23), 'ADB550023');
  assert.equal(formatCustomerId(999), 'ADB550999');
});

test('CUSTOMER_ID_REGEX validates canonical ids', () => {
  assert.ok(CUSTOMER_ID_REGEX.test('ADB550023'));
  assert.ok(CUSTOMER_ID_REGEX.test('ADB550001'));
  assert.ok(!CUSTOMER_ID_REGEX.test('CUST-0001'));
  assert.ok(!CUSTOMER_ID_REGEX.test('ADB55'));
});

test('isValidCustomerId recognises canonical ids', () => {
  assert.equal(isValidCustomerId('ADB550023'), true);
  assert.equal(isValidCustomerId('CUST-0001'), false);
  assert.equal(isValidCustomerId(''), false);
  assert.equal(isValidCustomerId(undefined), false);
});

test('normalizeCustomerId passes through canonical ids', () => {
  assert.equal(normalizeCustomerId('ADB550001'), 'ADB550001');
  assert.equal(normalizeCustomerId('ADB550023'), 'ADB550023');
});

test('normalizeCustomerId converts CUST-<digits>', () => {
  assert.equal(normalizeCustomerId('CUST-0001'), 'ADB550001');
  assert.equal(normalizeCustomerId('CUST-0023'), 'ADB550023');
  assert.equal(normalizeCustomerId('CUST-0000'), 'ADB550000');
  assert.equal(normalizeCustomerId('CUST-123'), 'ADB550123');
});

test('normalizeCustomerId converts pure-numeric ids', () => {
  assert.equal(normalizeCustomerId('0001'), 'ADB550001');
  assert.equal(normalizeCustomerId('1'), 'ADB550001');
  assert.equal(normalizeCustomerId('23'), 'ADB550023');
});

test('normalizeCustomerId converts CUST-<slug> deterministically', () => {
  const a = normalizeCustomerId('CUST-BIJOY');
  const b = normalizeCustomerId('CUST-BIJOY');
  assert.equal(a, b);
  assert.ok(/^ADB\d{6}$/.test(a));
  assert.notEqual(a, 'ADB550001');
});

test('normalizeCustomerId leaves unknown formats untouched', () => {
  assert.equal(normalizeCustomerId('SOME-THING'), 'SOME-THING');
  assert.equal(normalizeCustomerId(null), null);
});
