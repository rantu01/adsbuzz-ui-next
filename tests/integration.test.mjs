import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, closeDb } from '@/lib/db';

import * as settingsRoute from '@/app/api/settings/route';
import * as customersRoute from '@/app/api/customers/route';
import * as cardsRoute from '@/app/api/cards/route';
import * as cardDetailRoute from '@/app/api/cards/[id]/route';
import * as invoicesRoute from '@/app/api/invoices/route';
import * as topupsRoute from '@/app/api/topups/route';
import * as approveRoute from '@/app/api/invoices/[invoiceNo]/approve/route';
import * as rejectRoute from '@/app/api/invoices/[invoiceNo]/reject/route';
import * as syncRoute from '@/app/api/invoices/[invoiceNo]/sync-topup/route';
import * as feedbackRoute from '@/app/api/topups/[id]/feedback/route';
import * as finalApproveRoute from '@/app/api/topups/[id]/final-approve/route';
import * as finalRejectRoute from '@/app/api/topups/[id]/final-reject/route';
import * as topupsRejectRoute from '@/app/api/topups/[id]/reject/route';

const BASE = 'http://localhost';

function makeRequest(path, { method = 'GET', body, search = '' } = {}) {
  const url = `${BASE}${path}${search ? `?${search}` : ''}`;
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return new Request(url, init);
}

function params(invoiceNo) {
  return { params: Promise.resolve({ invoiceNo }) };
}

function topupParams(id) {
  return { params: Promise.resolve({ id }) };
}

before(async () => {
  const db = await getDb();
  await db.dropDatabase();
});

after(async () => {
  await closeDb();
});

test('GET /api/settings returns system settings', async () => {
  const res = await settingsRoute.GET(makeRequest('/api/settings'));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.settings);
  assert.ok(body.settings.defaultDollarRate > 0);
});

test('POST /api/customers creates a customer and GET lists it', async () => {
  const res = await customersRoute.POST(
    makeRequest('/api/customers', {
      method: 'POST',
      body: { name: 'Integration Test Corp', email: 'itc@example.com', companyName: 'ITC Ltd', phone: '+880 1711 000000', creditLimitUSD: 5000 },
    }),
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.customer.id);

  const listRes = await customersRoute.GET(makeRequest('/api/customers', { search: 'search=Integration' }));
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(list.customers.some((c) => c.email === 'itc@example.com'));
});

test('POST /api/customers rejects invalid email', async () => {
  const res = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Bad', email: 'not-an-email', companyName: 'X' } }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /email/i);
});

test('POST /api/cards registers a card and GET lists it', async () => {
  const res = await cardsRoute.POST(
    makeRequest('/api/cards', {
      method: 'POST',
      body: { cardName: 'TEST DBBL 9999', cardType: 'Visa', cardPlatform: 'RIZON', cardInitial: 'TD', status: 'Active' },
    }),
  );
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);

  const listRes = await cardsRoute.GET(makeRequest('/api/cards'));
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(list.cards.some((c) => c.cardName === 'TEST DBBL 9999'));
});

test('POST /api/cards rejects duplicate card names', async () => {
  const res = await cardsRoute.POST(
    makeRequest('/api/cards', { method: 'POST', body: { cardName: 'TEST DBBL 9999' } }),
  );
  assert.equal(res.status, 409);
});

test('PATCH /api/cards/:id updates a card', async () => {
  const res = await cardsRoute.POST(
    makeRequest('/api/cards', {
      method: 'POST',
      body: { id: 'CARD-PATCH-001', cardName: 'PATCH ME CARD', cardType: 'Visa', cardPlatform: 'WISE', cardInitial: 'PM', status: 'Active' },
    }),
  );
  assert.equal(res.status, 201);
  const { card } = await res.json();

  const patchRes = await cardDetailRoute.PATCH(
    makeRequest(`/api/cards/${card.id}`, { method: 'PATCH', body: { cardName: 'PATCH ME CARD UPDATED', cardPlatform: 'BYBIT' } }),
    { params: Promise.resolve({ id: card.id }) },
  );
  assert.equal(patchRes.status, 200);
  const patched = await patchRes.json();
  assert.equal(patched.card.cardName, 'PATCH ME CARD UPDATED');
  assert.equal(patched.card.cardPlatform, 'BYBIT');
});

test('PATCH /api/cards/:id with statusOnly toggles status', async () => {
  const res = await cardsRoute.POST(
    makeRequest('/api/cards', {
      method: 'POST',
      body: { id: 'CARD-PATCH-002', cardName: 'TOGGLE ME CARD', cardType: 'Visa', cardPlatform: 'RIZON', cardInitial: 'TM', status: 'Active' },
    }),
  );
  assert.equal(res.status, 201);
  const { card } = await res.json();

  const patchRes = await cardDetailRoute.PATCH(
    makeRequest(`/api/cards/${card.id}`, { method: 'PATCH', body: { statusOnly: true } }),
    { params: Promise.resolve({ id: card.id }) },
  );
  assert.equal(patchRes.status, 200);
  const patched = await patchRes.json();
  assert.notEqual(patched.card.status, 'Active');
});

test('DELETE /api/cards/:id removes a card', async () => {
  const res = await cardsRoute.POST(
    makeRequest('/api/cards', {
      method: 'POST',
      body: { id: 'CARD-DELETE-001', cardName: 'DELETE ME CARD', cardType: 'Mastercard', cardPlatform: 'RIZON', cardInitial: 'DM', status: 'Active' },
    }),
  );
  assert.equal(res.status, 201);
  const { card } = await res.json();

  const delRes = await cardDetailRoute.DELETE(
    makeRequest(`/api/cards/${card.id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id: card.id }) },
  );
  assert.equal(delRes.status, 200);

  const listRes = await cardsRoute.GET(makeRequest('/api/cards'));
  const list = await listRes.json();
  assert.ok(!list.cards.some((c) => c.id === card.id));
});

test('DELETE /api/cards/:id returns 404 for unknown card', async () => {
  const res = await cardDetailRoute.DELETE(
    makeRequest('/api/cards/DOES-NOT-EXIST', { method: 'DELETE' }),
    { params: Promise.resolve({ id: 'DOES-NOT-EXIST' }) },
  );
  assert.equal(res.status, 404);
});

test('E2E: create sale invoice, then approve topup via audit queue', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Sale Client', email: 'sale@example.com', companyName: 'Sale Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const invRes = await invoicesRoute.POST(
    makeRequest('/api/invoices', {
      method: 'POST',
      body: {
        customerId,
        adAccountId: 'test-sale-account-001',
        adAccountName: 'ADS_Test_Sale_001',
        topupAmountUSD: 100,
        dollarRate: 132,
        billingCard: 'TEST DBBL 9999',
        paymentMethod: 'TEST DBBL 9999',
        approvalStatus: 'Pending',
        topupStatus: 'Pending',
        note: 'Pending audit — author note recorded.',
      },
    }),
  );
  assert.equal(invRes.status, 201);
  const { invoice } = await invRes.json();
  assert.equal(invoice.paymentStatus, 'Due');
  assert.equal(invoice.approvalStatus, 'Pending');
  // New sales seed the audit log with a "created" entry by default.
  assert.ok(Array.isArray(invoice.auditLog));
  assert.equal(invoice.auditLog[0].action, 'created');

  const pendingRes = await topupsRoute.GET(makeRequest('/api/topups'));
  assert.equal(pendingRes.status, 200);
  const pending = await pendingRes.json();
  assert.ok(pending.topups.some((t) => t.invoiceNo === invoice.invoiceNo));

  const approveRes = await approveRoute.PATCH(makeRequest(`/api/invoices/${invoice.invoiceNo}/approve`, { method: 'PATCH' }), params(invoice.invoiceNo));
  assert.equal(approveRes.status, 200);
  const approved = await approveRes.json();
  assert.equal(approved.invoice.approvalStatus, 'Approved');
  assert.equal(approved.invoice.paymentStatus, 'Paid');
  assert.ok(approved.invoice.auditLog.some((e) => e.action === 'approved'));

  const listRes = await invoicesRoute.GET(makeRequest('/api/invoices', { search: `search=${invoice.invoiceNo}` }));
  const list = await listRes.json();
  const updated = list.invoices.find((i) => i.invoiceNo === invoice.invoiceNo);
  assert.equal(updated.approvalStatus, 'Approved');
});

test('E2E: reject topup moves audit to Waiting For Feedback', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Reject Client', email: 'reject@example.com', companyName: 'Reject Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const invRes = await invoicesRoute.POST(
    makeRequest('/api/invoices', {
      method: 'POST',
      body: { customerId, adAccountId: 'test-reject-001', topupAmountUSD: 50, approvalStatus: 'Pending', topupStatus: 'Pending', note: 'Reject test note' },
    }),
  );
  const { invoice } = await invRes.json();

  const rejectRes = await rejectRoute.PATCH(
    makeRequest(`/api/invoices/${invoice.invoiceNo}/reject`, { method: 'PATCH', body: { reason: 'Screenshot mismatch' } }),
    params(invoice.invoiceNo),
  );
  assert.equal(rejectRes.status, 200);
  const rejected = await rejectRes.json();
  assert.equal(rejected.invoice.approvalStatus, 'Waiting For Feedback');
  assert.equal(rejected.invoice.paymentStatus, 'Due');
  assert.ok(rejected.invoice.auditLog.some((e) => e.action === 'rejected' && e.reason === 'Screenshot mismatch'));
});

test('E2E: full audit workflow — reject, feedback, final reject', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Workflow Client', email: 'wf@example.com', companyName: 'Workflow Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const invRes = await invoicesRoute.POST(
    makeRequest('/api/invoices', {
      method: 'POST',
      body: { customerId, adAccountId: 'test-workflow-001', topupAmountUSD: 75, approvalStatus: 'Pending', topupStatus: 'Pending', note: 'Workflow test note' },
    }),
  );
  const { invoice } = await invRes.json();

  // Reject → Waiting For Feedback
  const topupRejectRes = await topupsRejectRoute.PATCH(
    makeRequest(`/api/topups/${invoice.invoiceNo}/reject`, { method: 'PATCH', body: { reason: 'Proof invalid' } }),
    topupParams(invoice.invoiceNo),
  );
  assert.equal(topupRejectRes.status, 200);
  const rejected = (await topupRejectRes.json()).invoice;
  assert.equal(rejected.approvalStatus, 'Waiting For Feedback');

  // Feedback → Final Approval Review
  const feedRes = await feedbackRoute.PATCH(
    makeRequest(`/api/topups/${invoice.invoiceNo}/feedback`, { method: 'PATCH', body: { feedback: 'Customer resent a valid screenshot.' } }),
    topupParams(invoice.invoiceNo),
  );
  assert.equal(feedRes.status, 200);
  const reviewed = (await feedRes.json()).invoice;
  assert.equal(reviewed.approvalStatus, 'Final Approval Review');

  // Final reject → Finally Rejected
  const finalRes = await finalRejectRoute.PATCH(
    makeRequest(`/api/topups/${invoice.invoiceNo}/final-reject`, { method: 'PATCH', body: { reason: 'Payment never received.' } }),
    topupParams(invoice.invoiceNo),
  );
  assert.equal(finalRes.status, 200);
  const finalized = (await finalRes.json()).invoice;
  assert.equal(finalized.approvalStatus, 'Finally Rejected');
  const actions = finalized.auditLog.map((e) => e.action);
  assert.deepEqual(actions, ['created', 'rejected', 'feedback_submitted', 'final_rejected']);
});

test('E2E: reject — feedback — final approve settles the audit', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Approve Client', email: 'appr@example.com', companyName: 'Approve Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const invRes = await invoicesRoute.POST(
    makeRequest('/api/invoices', {
      method: 'POST',
      body: { customerId, adAccountId: 'test-final-approve-001', topupAmountUSD: 40, approvalStatus: 'Pending', topupStatus: 'Pending', note: 'Final approve test note' },
    }),
  );
  const { invoice } = await invRes.json();

  const rejectRes = await rejectRoute.PATCH(
    makeRequest(`/api/invoices/${invoice.invoiceNo}/reject`, { method: 'PATCH', body: { reason: 'Review needed' } }),
    params(invoice.invoiceNo),
  );
  const rejected = (await rejectRes.json()).invoice;
  assert.equal(rejected.approvalStatus, 'Waiting For Feedback');

  const feedRes = await feedbackRoute.PATCH(
    makeRequest(`/api/topups/${invoice.invoiceNo}/feedback`, { method: 'PATCH', body: { feedback: 'Confirmed by customer.' } }),
    topupParams(invoice.invoiceNo),
  );
  assert.equal(feedRes.status, 200);
  const reviewed = (await feedRes.json()).invoice;
  assert.equal(reviewed.approvalStatus, 'Final Approval Review');

  const finalApprRes = await finalApproveRoute.PATCH(
    makeRequest(`/api/topups/${invoice.invoiceNo}/final-approve`, { method: 'PATCH' }),
    topupParams(invoice.invoiceNo),
  );
  assert.equal(finalApprRes.status, 200);
  const settled = (await finalApprRes.json()).invoice;
  assert.equal(settled.approvalStatus, 'Approved');
  assert.equal(settled.paymentStatus, 'Paid');
  assert.ok(settled.auditLog.some((e) => e.action === 'final_approved'));
});

test('PATCH sync-topup updates topup status', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Sync Client', email: 'sync@example.com', companyName: 'Sync Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const invRes = await invoicesRoute.POST(
    makeRequest('/api/invoices', {
      method: 'POST',
      body: { customerId, adAccountId: 'test-sync-001', topupAmountUSD: 25, approvalStatus: 'Approved', topupStatus: 'Pending', note: 'Sync test note' },
    }),
  );
  const { invoice } = await invRes.json();

  const syncRes = await syncRoute.PATCH(makeRequest(`/api/invoices/${invoice.invoiceNo}/sync-topup`, { method: 'PATCH', body: { status: 'Successfull' } }), params(invoice.invoiceNo));
  assert.equal(syncRes.status, 200);
  const synced = await syncRes.json();
  assert.equal(synced.invoice.topupStatus, 'Successfull');
});

test('PATCH approve unknown invoice returns 404', async () => {
  const res = await approveRoute.PATCH(makeRequest('/api/invoices/ADB 999999/approve', { method: 'PATCH' }), params('ADB 999999'));
  assert.equal(res.status, 404);
});

test('GET /api/customers supports page/limit pagination', async () => {
  const res = await customersRoute.GET(makeRequest('/api/customers', { search: 'limit=1&page=1' }));
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.limit, 1);
  assert.ok(body.total >= 1);
  assert.equal(body.customers.length, 1);
  assert.equal(body.totalPages, body.total);
});
