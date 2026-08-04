import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPagination, paginate } from '@/utils/pagination';

test('getPagination parses and clamps page/limit', () => {
  assert.deepEqual(getPagination(new URL('http://x').searchParams), { page: 1, limit: 50, skip: 0 });
  assert.deepEqual(getPagination(new URL('http://x?page=2&limit=10').searchParams), { page: 2, limit: 10, skip: 10 });
  assert.deepEqual(getPagination(new URL('http://x?page=0&limit=9999').searchParams), { page: 1, limit: 200, skip: 0 });
  assert.deepEqual(getPagination(new URL('http://x?page=abc&limit=abc').searchParams), { page: 1, limit: 50, skip: 0 });
});

test('paginate slices and reports totals', () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  const p = paginate(items, getPagination(new URL('http://x?page=2&limit=10').searchParams));
  assert.equal(p.total, 25);
  assert.equal(p.totalPages, 3);
  assert.equal(p.data.length, 10);
  assert.equal(p.data[0], 10);
});

test('paginate clamps to last available page data', () => {
  const items = [1, 2, 3];
  const p = paginate(items, getPagination(new URL('http://x?page=5&limit=2').searchParams));
  assert.equal(p.data.length, 0);
  assert.equal(p.total, 3);
});

test('paginate handles empty and non-array input', () => {
  assert.equal(paginate([], { limit: 10 }).total, 0);
  assert.equal(paginate(undefined, { limit: 10 }).data.length, 0);
});
