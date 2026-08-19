import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getDb, closeDb } from '@/lib/db';

import * as settingsRoute from '@/app/api/settings/route';
import * as customersRoute from '@/app/api/customers/route';
import * as cardsRoute from '@/app/api/cards/route';
import * as cardDetailRoute from '@/app/api/cards/[id]/route';
import * as platformsRoute from '@/app/api/platforms/route';
import * as platformDetailRoute from '@/app/api/platforms/[id]/route';
import * as walletsRoute from '@/app/api/wallets/route';
import * as walletDetailRoute from '@/app/api/wallets/[id]/route';
import * as invoicesRoute from '@/app/api/invoices/route';
import * as historicalInvoicesRoute from '@/app/api/invoices/historical/route';
import { getCustomerTopupSummary } from '@/models/invoiceModel';
import * as topupsRoute from '@/app/api/topups/route';
import * as approveRoute from '@/app/api/invoices/[invoiceNo]/approve/route';
import * as rejectRoute from '@/app/api/invoices/[invoiceNo]/reject/route';
import * as syncRoute from '@/app/api/invoices/[invoiceNo]/sync-topup/route';
import * as payRoute from '@/app/api/invoices/[invoiceNo]/pay/route';
import * as feedbackRoute from '@/app/api/topups/[id]/feedback/route';
import * as finalApproveRoute from '@/app/api/topups/[id]/final-approve/route';
import * as finalRejectRoute from '@/app/api/topups/[id]/final-reject/route';
import * as topupsRejectRoute from '@/app/api/topups/[id]/reject/route';
import * as adAccountsRoute from '@/app/api/ad-accounts/route';
import * as assignRoute from '@/app/api/ad-accounts/[id]/assign/route';
import * as unassignRoute from '@/app/api/ad-accounts/[id]/unassign/route';
import * as socialAdAccountsRoute from '@/app/api/social-ad-accounts/route';
import * as saleSetupsRoute from '@/app/api/sale-setups/route';
import * as saleSetupDetailRoute from '@/app/api/sale-setups/[id]/route';

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

function accountParams(id) {
  return { params: Promise.resolve({ id }) };
}

function setupParams(id) {
  return { params: Promise.resolve({ id }) };
}

before(async () => {
  const db = await getDb();
  await db.dropDatabase();
});

after(async () => {
  await closeDb();
});

test('E2E: social ad account (Ad Account Inventory) can be assigned and marked Sold', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', {
      method: 'POST',
      body: { name: 'Social Assign Client', email: 'socialassign@example.com', companyName: 'Social Assign Ltd', groupId: 'GC-SOCIAL-ASSIGN' },
    }),
  );
  assert.equal(custRes.status, 201);
  const customer = (await custRes.json()).customer;

  const socialRes = await socialAdAccountsRoute.POST(
    makeRequest('/api/social-ad-accounts', {
      method: 'POST',
      body: { adAccountId: 'acc-social-001', adAccountName: 'ADS_Social_001', platform: 'TikTok', accountStatus: 'Available', seriesId: 'SRC-TK' },
    }),
  );
  assert.equal(socialRes.status, 201);
  const social = (await socialRes.json()).adAccount;
  assert.equal(social.source, 'social');

  // Assignment via the shared ad-accounts endpoint must resolve social accounts
  // (the fix for the "Ad account not found" assignment failure) and mark them Sold.
  const assignRes = await assignRoute.POST(
    makeRequest(`/api/ad-accounts/${social.adAccountId}/assign`, { method: 'POST', body: { customerId: customer.id } }),
    accountParams(social.adAccountId),
  );
  assert.equal(assignRes.status, 200);
  const assigned = (await assignRes.json()).adAccount;
  assert.equal(assigned.assignedCustomer, customer.id);
  assert.equal(assigned.accountStatus, 'Sold');

  const listRes = await socialAdAccountsRoute.GET(makeRequest('/api/social-ad-accounts'));
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  const persisted = list.adAccounts.find((a) => a.adAccountId === social.adAccountId);
  assert.ok(persisted, 'social account still listed after assignment');
  assert.equal(persisted.assignedCustomer, customer.id);
  assert.equal(persisted.accountStatus, 'Sold');

  // Unassign returns it to the available pool.
  const unassignRes = await unassignRoute.POST(
    makeRequest(`/api/ad-accounts/${social.adAccountId}/unassign`, { method: 'POST' }),
    accountParams(social.adAccountId),
  );
  assert.equal(unassignRes.status, 200);
  const unassigned = (await unassignRes.json()).adAccount;
  assert.equal(unassigned.assignedCustomer, '');
  assert.equal(unassigned.accountStatus, 'Available');
});

test('POST /api/ad-accounts/:id/assign requires a customer', async () => {
  const res = await assignRoute.POST(
    makeRequest('/api/ad-accounts/whatever/assign', { method: 'POST', body: { customerId: '' } }),
    accountParams('whatever'),
  );
  assert.equal(res.status, 400);
});

test('POST /api/ad-accounts/:id/assign returns 404 for unknown account', async () => {
  const res = await assignRoute.POST(
    makeRequest('/api/ad-accounts/DOES-NOT-EXIST/assign', { method: 'POST', body: { customerId: 'CUST-404' } }),
    accountParams('DOES-NOT-EXIST'),
  );
  assert.equal(res.status, 404);
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

test('deleted seed card does not reappear on subsequent lists', async () => {
  const listRes = await cardsRoute.GET(makeRequest('/api/cards'));
  const { cards } = await listRes.json();
  const seedCard = cards.find((c) => c.cardName === 'ADSBUZZ EBL - 1342');
  assert.ok(seedCard, 'seed card should be present');

  const delRes = await cardDetailRoute.DELETE(
    makeRequest(`/api/cards/${seedCard.id}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id: seedCard.id }) },
  );
  assert.equal(delRes.status, 200);

  for (let i = 0; i < 2; i += 1) {
    const again = await cardsRoute.GET(makeRequest('/api/cards'));
    const list = await again.json();
    assert.ok(
      !list.cards.some((c) => c.id === seedCard.id),
      `seed card must stay deleted after list call #${i + 1}`,
    );
  }
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

test('deleted seed platform does not reappear on subsequent lists', async () => {
  const listRes = await platformsRoute.GET(makeRequest('/api/platforms'));
  const { platforms } = await listRes.json();
  const seed = platforms.find((p) => p.platformId === 'PLAT-001');
  assert.ok(seed, 'seed platform should be present');

  const delRes = await platformDetailRoute.DELETE(
    makeRequest(`/api/platforms/${seed.platformId}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id: seed.platformId }) },
  );
  assert.equal(delRes.status, 200);

  const again = await platformsRoute.GET(makeRequest('/api/platforms'));
  const list = await again.json();
  assert.ok(
    !list.platforms.some((p) => p.platformId === seed.platformId),
    'seed platform must stay deleted',
  );
});

test('deleting all platforms does not re-seed them', async () => {
  const listRes = await platformsRoute.GET(makeRequest('/api/platforms'));
  const { platforms } = await listRes.json();

  for (const p of platforms) {
    const delRes = await platformDetailRoute.DELETE(
      makeRequest(`/api/platforms/${p.platformId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: p.platformId }) },
    );
    assert.equal(delRes.status, 200);
  }

  const after = await platformsRoute.GET(makeRequest('/api/platforms'));
  const { platforms: afterList } = await after.json();
  assert.equal(afterList.length, 0, 'emptied platform collection must not be re-seeded');
});

test('deleted seed wallet does not reappear on subsequent lists', async () => {
  const listRes = await walletsRoute.GET(makeRequest('/api/wallets'));
  const { wallets } = await listRes.json();
  const seed = wallets.find((w) => w.walletId === 'WALLET-001');
  assert.ok(seed, 'seed wallet should be present');

  const delRes = await walletDetailRoute.DELETE(
    makeRequest(`/api/wallets/${seed.walletId}`, { method: 'DELETE' }),
    { params: Promise.resolve({ id: seed.walletId }) },
  );
  assert.equal(delRes.status, 200);

  const again = await walletsRoute.GET(makeRequest('/api/wallets'));
  const list = await again.json();
  assert.ok(
    !list.wallets.some((w) => w.walletId === seed.walletId),
    'seed wallet must stay deleted',
  );
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

test('POST /api/invoices/historical records a past sale without live side effects', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Historical Client', email: 'hist@example.com', companyName: 'Hist Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const histRes = await historicalInvoicesRoute.POST(
    makeRequest('/api/invoices/historical', {
      method: 'POST',
      body: {
        date: '2024-05-15',
        customerId,
        groupId: 'GC-HIST',
        adAccountId: 'hist-account-001',
        adAccountName: 'ADS_Historical_001',
        serviceType: 'Ad Account Topup',
        dollarRate: 130,
        topupAmountUSD: 200,
        paidAmountBDT: 26000,
        totalAmountBDT: 26000,
        paymentMethod: 'Wire Transfer',
        note: 'Backfilled pre-system sale.',
      },
    }),
  );
  assert.equal(histRes.status, 201);
  const { invoice } = await histRes.json();

  // Stored as a historical, pre-approved record on the exact past date.
  assert.equal(invoice.source, 'historical');
  assert.equal(invoice.date, '2024-05-15');
  assert.equal(invoice.approvalStatus, 'Approved');
  assert.equal(invoice.topupAmountUSD, 200);
  assert.equal(invoice.totalAmountBDT, 26000);
  // Invoice number carries the historical month prefix, not the current one.
  assert.match(invoice.invoiceNo, /^ADB 202405/);

  // Visible in the full invoice list (Sales Entry Records / history)...
  const listRes = await invoicesRoute.GET(makeRequest('/api/invoices', { search: `search=${invoice.invoiceNo}` }));
  const list = await listRes.json();
  assert.ok(list.invoices.some((i) => i.invoiceNo === invoice.invoiceNo));

  // ...but NOT in the pending topup approval queue.
  const pendingRes = await topupsRoute.GET(makeRequest('/api/topups', { search: 'scope=pending' }));
  const pending = await pendingRes.json();
  assert.ok(!pending.topups.some((t) => t.invoiceNo === invoice.invoiceNo));

  // And never counts toward the customer's live topup summary.
  const summary = await getCustomerTopupSummary(customerId);
  assert.equal(summary.lifetimeTotalTopupUSD, 0);
  assert.equal(summary.currentMonthTotalTopupUSD, 0);
});

test('POST /api/invoices/historical rejects today/future dates', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Hist Date Client', email: 'histdate@example.com', companyName: 'Hist Date Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const future = new Date();
  future.setUTCFullYear(future.getUTCFullYear() + 1);
  const futureDate = future.toISOString().split('T')[0];

  const res = await historicalInvoicesRoute.POST(
    makeRequest('/api/invoices/historical', {
      method: 'POST',
      body: { date: futureDate, customerId, adAccountId: 'hist-future-001', topupAmountUSD: 10, paidAmountBDT: 1300, note: 'future' },
    }),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /past date|before today/i);
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
    makeRequest(`/api/topups/${invoice.invoiceNo}/feedback`, { method: 'PATCH', body: { feedback: 'Customer resent a valid screenshot.', screenshot: '/uploads/feedback-proof.png' } }),
    topupParams(invoice.invoiceNo),
  );
  assert.equal(feedRes.status, 200);
  const reviewed = (await feedRes.json()).invoice;
  assert.equal(reviewed.approvalStatus, 'Final Approval Review');
  assert.ok(reviewed.screenshots.some((s) => s.url === '/uploads/feedback-proof.png' && s.source === 'feedback'));

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

test('E2E: record payments against a Due invoice updates totals and logs history', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Pay Client', email: 'pay@example.com', companyName: 'Pay Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const invRes = await invoicesRoute.POST(
    makeRequest('/api/invoices', {
      method: 'POST',
      body: { customerId, adAccountId: 'test-pay-001', adAccountName: 'ADS_Pay_001', topupAmountUSD: 100, dollarRate: 132, approvalStatus: 'Approved', topupStatus: 'Successfull', note: 'Pay flow test note' },
    }),
  );
  assert.equal(invRes.status, 201);
  const { invoice } = await invRes.json();
  assert.equal(invoice.paymentStatus, 'Due');
  assert.equal(invoice.paidAmountBDT, 0);
  assert.equal(invoice.dueAmountBDT, 13200);

  // Partial payment: Due → Partially Paid
  const pay1Res = await payRoute.POST(
    makeRequest(`/api/invoices/${invoice.invoiceNo}/pay`, {
      method: 'POST',
      body: { amountBDT: 5000, paymentMethod: 'bKash', date: '2026-06-15', transactionId: 'TXN-PAY-001', note: 'First installment' },
    }),
    params(invoice.invoiceNo),
  );
  assert.equal(pay1Res.status, 201);
  const paid1 = (await pay1Res.json()).invoice;
  assert.equal(paid1.paymentStatus, 'Partially Paid');
  assert.equal(paid1.paidAmountBDT, 5000);
  assert.equal(paid1.dueAmountBDT, 8200);
  assert.ok(Array.isArray(paid1.payments));
  assert.equal(paid1.payments.length, 1);
  assert.equal(paid1.payments[0].amountBDT, 5000);
  assert.equal(paid1.payments[0].paymentMethod, 'bKash');
  assert.equal(paid1.payments[0].transactionId, 'TXN-PAY-001');
  assert.ok(paid1.auditLog.some((e) => e.action === 'payment_received' && e.status === 'Partially Paid'));

  // Remaining payment: Partially Paid → Paid
  const pay2Res = await payRoute.POST(
    makeRequest(`/api/invoices/${invoice.invoiceNo}/pay`, {
      method: 'POST',
      body: { amountBDT: 8200, paymentMethod: 'Nagad' },
    }),
    params(invoice.invoiceNo),
  );
  assert.equal(pay2Res.status, 201);
  const paid2 = (await pay2Res.json()).invoice;
  assert.equal(paid2.paymentStatus, 'Paid');
  assert.equal(paid2.paidAmountBDT, 13200);
  assert.equal(paid2.dueAmountBDT, 0);
  assert.equal(paid2.payments.length, 2);
  assert.ok(paid2.auditLog.some((e) => e.action === 'payment_received' && e.status === 'Paid'));

  // Fully-paid invoices reject further payments
  const overPayRes = await payRoute.POST(
    makeRequest(`/api/invoices/${invoice.invoiceNo}/pay`, {
      method: 'POST',
      body: { amountBDT: 100 },
    }),
    params(invoice.invoiceNo),
  );
  assert.equal(overPayRes.status, 400);
  const overBody = await overPayRes.json();
  assert.match(overBody.message, /fully paid|outstanding/i);
});

test('POST /api/invoices/:invoiceNo/pay rejects overpayment beyond the due', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', { method: 'POST', body: { name: 'Overpay Client', email: 'overpay@example.com', companyName: 'Overpay Ltd' } }),
  );
  const customerId = (await custRes.json()).customer.id;

  const invRes = await invoicesRoute.POST(
    makeRequest('/api/invoices', {
      method: 'POST',
      body: { customerId, adAccountId: 'test-overpay-001', topupAmountUSD: 50, dollarRate: 132, approvalStatus: 'Approved', topupStatus: 'Successfull', note: 'Overpay test' },
    }),
  );
  const { invoice } = await invRes.json();

  const res = await payRoute.POST(
    makeRequest(`/api/invoices/${invoice.invoiceNo}/pay`, { method: 'POST', body: { amountBDT: 999999 } }),
    params(invoice.invoiceNo),
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /exceeds the outstanding due/i);
});

test('POST /api/invoices/:invoiceNo/pay returns 404 for unknown invoice', async () => {
  const res = await payRoute.POST(
    makeRequest('/api/invoices/ADB 888888/pay', { method: 'POST', body: { amountBDT: 100 } }),
    params('ADB 888888'),
  );
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

test('POST /api/sale-setups stores a custom dollar rate', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', {
      method: 'POST',
      body: { name: 'Rate Client', email: 'rate@example.com', companyName: 'Rate Ltd', groupId: 'GC-RATE-TEST' },
    }),
  );
  const customer = (await custRes.json()).customer;

  const res = await saleSetupsRoute.POST(
    makeRequest('/api/sale-setups', {
      method: 'POST',
      body: {
        groupId: customer.groupId,
        serviceType: 'Ad Account Sales Setup',
        adAccountId: 'acc-rate-001',
        adName: 'ADS_Rate_001',
        platform: 'Facebook',
        dollarRate: 140,
        monthlySpending: 800,
        status: 'Active',
      },
    }),
  );
  assert.equal(res.status, 201);
  const { setup } = await res.json();
  assert.equal(setup.dollarRate, 140);
  assert.equal(setup.adAccountId, 'acc-rate-001');
});

test('E2E: unassigning an ad account auto-terminates its Sale Setup but keeps history', async () => {
  const custRes = await customersRoute.POST(
    makeRequest('/api/customers', {
      method: 'POST',
      body: { name: 'Unassign Client', email: 'unassign@example.com', companyName: 'Unassign Ltd', groupId: 'GC-UNASSIGN-TEST' },
    }),
  );
  assert.equal(custRes.status, 201);
  const customer = (await custRes.json()).customer;

  const accRes = await adAccountsRoute.POST(
    makeRequest('/api/ad-accounts', {
      method: 'POST',
      body: { adAccountId: 'acc-unassign-001', adAccountName: 'ADS_Unassign_001', platform: 'Facebook', accountStatus: 'Available', dollarRate: 130, monthlySpending: 500 },
    }),
  );
  assert.equal(accRes.status, 201);
  const account = (await accRes.json()).adAccount;

  const assignRes = await assignRoute.POST(
    makeRequest(`/api/ad-accounts/${account.adAccountId}/assign`, { method: 'POST', body: { customerId: customer.id } }),
    accountParams(account.adAccountId),
  );
  assert.equal(assignRes.status, 200);

  const setupRes = await saleSetupsRoute.POST(
    makeRequest('/api/sale-setups', {
      method: 'POST',
      body: {
        groupId: customer.groupId,
        serviceType: 'Ad Account Sales Setup',
        adAccountId: account.adAccountId,
        adName: account.adAccountName,
        platform: 'Facebook',
        dollarRate: 130,
        monthlySpending: 500,
        status: 'Active',
      },
    }),
  );
  assert.equal(setupRes.status, 201);
  const { setup } = await setupRes.json();
  assert.equal(setup.status, 'Active');

  const invRes = await invoicesRoute.POST(
    makeRequest('/api/invoices', {
      method: 'POST',
      body: { customerId: customer.id, adAccountId: account.adAccountId, adAccountName: account.adAccountName, topupAmountUSD: 100, dollarRate: 130, approvalStatus: 'Pending', topupStatus: 'Successfull', note: 'History must survive unassign' },
    }),
  );
  assert.equal(invRes.status, 201);
  const { invoice } = await invRes.json();

  const unassignRes = await unassignRoute.POST(
    makeRequest(`/api/ad-accounts/${account.adAccountId}/unassign`, { method: 'POST' }),
    accountParams(account.adAccountId),
  );
  assert.equal(unassignRes.status, 200);
  const unassigned = (await unassignRes.json()).adAccount;
  assert.equal(unassigned.assignedCustomer, '');

  const setupGetRes = await saleSetupDetailRoute.GET(
    makeRequest(`/api/sale-setups/${setup.id}`),
    setupParams(setup.id),
  );
  assert.equal(setupGetRes.status, 200);
  const { setup: terminated } = await setupGetRes.json();
  assert.equal(terminated.status, 'Terminated');

  const invListRes = await invoicesRoute.GET(makeRequest('/api/invoices', { search: `search=${invoice.invoiceNo}` }));
  const invList = await invListRes.json();
  const saved = invList.invoices.find((i) => i.invoiceNo === invoice.invoiceNo);
  assert.ok(saved, 'sales history must remain after unassign');
  assert.equal(saved.topupAmountUSD, 100);
  assert.equal(saved.customerId, customer.id);

  // Re-assign the same account to the same group and create a NEW setup.
  // The terminated setup must no longer block a fresh setup, and the old
  // terminated record must stay in the database for history.
  const reassignRes = await assignRoute.POST(
    makeRequest(`/api/ad-accounts/${account.adAccountId}/assign`, { method: 'POST', body: { customerId: customer.id } }),
    accountParams(account.adAccountId),
  );
  assert.equal(reassignRes.status, 200);

  const recreateRes = await saleSetupsRoute.POST(
    makeRequest('/api/sale-setups', {
      method: 'POST',
      body: {
        groupId: customer.groupId,
        serviceType: 'Ad Account Sales Setup',
        adAccountId: account.adAccountId,
        adName: account.adAccountName,
        platform: 'Facebook',
        dollarRate: 135,
        monthlySpending: 600,
        status: 'Active',
      },
    }),
  );
  assert.equal(recreateRes.status, 201, 'terminated setup must not block a new setup');
  const { setup: fresh } = await recreateRes.json();
  assert.equal(fresh.status, 'Active');
  assert.notEqual(fresh.id, setup.id, 'new setup must be a separate record');

  const oldSetupRes = await saleSetupDetailRoute.GET(
    makeRequest(`/api/sale-setups/${setup.id}`),
    setupParams(setup.id),
  );
  assert.equal(oldSetupRes.status, 200);
  const { setup: oldSetup } = await oldSetupRes.json();
  assert.equal(oldSetup.status, 'Terminated', 'old terminated setup must remain for history');
});
