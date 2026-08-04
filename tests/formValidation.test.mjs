import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  required,
  email,
  phone,
  positiveNumber,
  min,
  maxLength,
  maxBytes,
  oneOf,
  validate,
  hasErrors,
} from '@/utils/formValidation';

test('required rejects empty/blank values', () => {
  assert.ok(required()(''));
  assert.ok(required()('   '));
  assert.ok(required('custom')());
  assert.equal(required('custom')('x'), undefined);
  assert.equal(required()(0), undefined);
});

test('email validates common formats', () => {
  assert.equal(email()('support@bijoy.com'), undefined);
  assert.equal(email()('a.b+c@sub.co'), undefined);
  assert.ok(email()('not-an-email'));
  assert.ok(email()('a@b'));
  assert.equal(email()(''), undefined);
});

test('phone accepts digits and separators', () => {
  assert.equal(phone()('+880 1711-234567'), undefined);
  assert.equal(phone()('01711234567'), undefined);
  assert.ok(phone()('abc'));
  assert.equal(phone()(''), undefined);
});

test('positiveNumber rejects non-positive values', () => {
  assert.equal(positiveNumber()(132), undefined);
  assert.ok(positiveNumber()(0));
  assert.ok(positiveNumber()(-5));
  assert.ok(positiveNumber()('abc'));
  assert.equal(positiveNumber()(''), undefined);
});

test('min enforces lower bound', () => {
  assert.equal(min(1)(5), undefined);
  assert.ok(min(5)(3));
});

test('maxLength enforces upper bound', () => {
  assert.equal(maxLength(10)('short'), undefined);
  assert.ok(maxLength(3)('abcd'));
  assert.equal(maxLength(3)(''), undefined);
});

test('maxBytes rejects oversize files', () => {
  assert.equal(maxBytes(1024)({ size: 512 }), undefined);
  assert.ok(maxBytes(1024)({ size: 2048 }));
  assert.equal(maxBytes(1024)(null), undefined);
});

test('oneOf restricts to allowed values', () => {
  const rule = oneOf(['Paid', 'Due']);
  assert.equal(rule('Paid'), undefined);
  assert.ok(rule('Refunded'));
  assert.equal(rule(''), undefined);
});

test('validate aggregates errors across fields', () => {
  const errors = validate(
    { name: '', email: 'bad' },
    { name: [required('Name required')], email: [required(), email()] },
  );
  assert.equal(errors.name, 'Name required');
  assert.ok(errors.email);
});

test('validate returns first error per field only', () => {
  const errors = validate(
    { name: '' },
    { name: [required('Required'), maxLength(3, 'Too long')] },
  );
  assert.equal(errors.name, 'Required');
});

test('hasErrors reflects any errors', () => {
  assert.equal(hasErrors({}), false);
  assert.equal(hasErrors({ name: 'bad' }), true);
  assert.equal(hasErrors(null), false);
});
