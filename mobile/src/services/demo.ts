import * as SecureStore from 'expo-secure-store';

type DemoRecord = Record<string, any>;
type DemoState = {
  products: DemoRecord[];
  customers: DemoRecord[];
  suppliers: DemoRecord[];
  stores: DemoRecord[];
  staff: DemoRecord[];
  campaigns: DemoRecord[];
  purchaseOrders: DemoRecord[];
  approvals: DemoRecord[];
  notifications: DemoRecord[];
  transactions: DemoRecord[];
  settlements: DemoRecord[];
  conversations: Record<string, DemoRecord[]>;
};

const STATE_KEY = 'business_partner_demo_state_v1';
const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const day = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

function initialState(): DemoState {
  const campaignId = 'campaign-sample-1';
  return {
    products: [
      { id: 'product-tea', name: 'Masala chai', sku: 'DRK-001', quantity: 8, reorder_level: 10, unit: 'cups', active: true },
      { id: 'product-coffee', name: 'Filter coffee', sku: 'DRK-002', quantity: 24, reorder_level: 8, unit: 'cups', active: true },
      { id: 'product-snack', name: 'Samosa', sku: 'SNK-004', quantity: 5, reorder_level: 12, unit: 'pieces', active: true },
    ],
    customers: [
      { id: 'customer-1', display_name: 'Asha (sample)', contact_hash: null, consent_marketing: true, created_at: day(72) },
      { id: 'customer-2', display_name: 'Ravi (sample)', contact_hash: null, consent_marketing: false, created_at: day(30) },
    ],
    suppliers: [{ id: 'supplier-1', name: 'City Wholesale (sample)', contact: null, active: true }],
    stores: [{ id: 'store-1', name: 'Main Street (sample)', code: 'DEMO-01', active: true }],
    staff: [{ id: 'staff-1', display_name: 'Demo Manager', role: 'manager', store_id: 'store-1', active: true }],
    campaigns: [{ id: campaignId, name: 'Weekend special (sample)', message: 'A sample offer for opted-in customers only.', status: 'draft', created_at: day(8) }],
    purchaseOrders: [{ id: 'po-sample-1', supplier_id: 'supplier-1', lines: [{ product_id: 'product-tea', quantity: 20, unit_cost: '15.00' }], status: 'draft', created_at: day(5) }],
    approvals: [{ id: 'approval-sample-1', kind: 'purchase_order', status: 'pending', expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), payload: { note: 'Sample order review only' } }],
    notifications: [{ id: 'notification-sample-1', title: 'Welcome to the sample workspace', body: 'All records in this workspace are fictional.', category: 'info', read_at: null, created_at: now() }],
    transactions: [
      { id: 'tx-1', external_id: 'DEMO-1001', amount: '1250.00', status: 'succeeded', payment_method: 'UPI', occurred_at: day(1), source: 'sample_data' },
      { id: 'tx-2', external_id: 'DEMO-1002', amount: '840.00', status: 'succeeded', payment_method: 'UPI', occurred_at: day(3), source: 'sample_data' },
      { id: 'tx-3', external_id: 'DEMO-1003', amount: '560.00', status: 'succeeded', payment_method: 'card', occurred_at: day(5), source: 'sample_data' },
      { id: 'tx-4', external_id: 'DEMO-1004', amount: '199.00', status: 'refunded', payment_method: 'UPI', occurred_at: day(7), source: 'sample_data' },
      { id: 'tx-5', external_id: 'DEMO-1005', amount: '1320.00', status: 'succeeded', payment_method: 'UPI', occurred_at: day(9), source: 'sample_data' },
      { id: 'tx-6', external_id: 'DEMO-1006', amount: '740.00', status: 'succeeded', payment_method: 'cash', occurred_at: day(12), source: 'sample_data' },
      { id: 'tx-7', external_id: 'DEMO-1007', amount: '980.00', status: 'succeeded', payment_method: 'UPI', occurred_at: day(27), source: 'sample_data' },
      { id: 'tx-8', external_id: 'DEMO-1008', amount: '610.00', status: 'succeeded', payment_method: 'UPI', occurred_at: day(31), source: 'sample_data' },
    ],
    settlements: [
      { id: 'settlement-1', amount: '3210.00', status: 'pending', expected_at: day(-18), settled_at: null },
      { id: 'settlement-2', amount: '1840.00', status: 'settled', expected_at: day(30), settled_at: day(26) },
    ],
    conversations: {},
  };
}

async function loadState(): Promise<DemoState> {
  try {
    const saved = await SecureStore.getItemAsync(STATE_KEY);
    if (saved) return { ...initialState(), ...JSON.parse(saved) } as DemoState;
  } catch { /* use a fresh sample workspace when saved state is unreadable */ }
  return initialState();
}

async function saveState(state: DemoState) {
  await SecureStore.setItemAsync(STATE_KEY, JSON.stringify(state));
}

function response<T>(value: unknown): T { return value as T; }

export async function demoApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, 'https://offline.demo');
  const route = url.pathname;
  const method = (init.method ?? 'GET').toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) as DemoRecord : {};
  const state = await loadState();
  let result: unknown;
  let changed = false;

  if (route === '/dashboard/sales') {
    result = { currency: 'INR', collection_total: '4710.00', successful_transactions: 5, refunds_total: '199.00', pending_settlements: '3210.00', source: 'fictional demo records', as_of: now(), data_available: true };
  } else if (route === '/transactions' && method === 'GET') result = state.transactions;
  else if (route === '/cashflow/settlements') result = state.settlements;
  else if (route === '/cashflow/forecast') result = { known_pending_receipts_next_24h: '3210.00', settlement_count: 1, forecast_type: 'sample expected dates', assumptions: ['Fictional records only.'], uncertainty: 'Not a guaranteed receipt.' };
  else if (route === '/inventory' && method === 'GET') result = state.products;
  else if (route === '/inventory' && method === 'POST') {
    const row = { id: id('product'), sku: null, quantity: 0, reorder_level: 0, unit: 'unit', active: true, ...body };
    state.products.unshift(row); result = row; changed = true;
  } else if (route === '/inventory/alerts') result = state.products.filter(p => p.quantity <= p.reorder_level).map(p => ({ product_id: p.id, name: p.name, quantity: p.quantity, reorder_level: p.reorder_level }));
  else if (route === '/stores' && method === 'GET') result = state.stores;
  else if (route === '/stores' && method === 'POST') { const row = { id: id('store'), active: true, ...body }; state.stores.unshift(row); result = row; changed = true; }
  else if (route === '/customers' && method === 'GET') result = state.customers;
  else if (route === '/customers' && method === 'POST') { const row = { id: id('customer'), contact_hash: null, consent_marketing: false, created_at: now(), ...body }; state.customers.unshift(row); result = row; changed = true; }
  else if (/^\/customers\/[^/]+\/marketing-consent$/.test(route) && method === 'PATCH') {
    const customer = state.customers.find(row => row.id === route.split('/')[2]);
    if (!customer) throw new Error('Sample customer was not found.'); customer.consent_marketing = Boolean(body.consent); result = { customer_id: customer.id, consent_marketing: customer.consent_marketing }; changed = true;
  } else if (route === '/suppliers' && method === 'GET') result = state.suppliers;
  else if (route === '/suppliers' && method === 'POST') { const row = { id: id('supplier'), contact: null, active: true, ...body }; state.suppliers.unshift(row); result = row; changed = true; }
  else if (route === '/staff' && method === 'GET') result = state.staff;
  else if (route === '/staff' && method === 'POST') { const row = { id: id('staff'), store_id: null, active: true, ...body }; state.staff.unshift(row); result = row; changed = true; }
  else if (route === '/campaigns' && method === 'GET') result = state.campaigns;
  else if (route === '/campaigns' && method === 'POST') { const row = { id: id('campaign'), status: 'draft', created_at: now(), ...body }; state.campaigns.unshift(row); result = { ...row, delivery_enabled: false, consent_required: true }; changed = true; }
  else if (/^\/campaigns\/[^/]+\/prepare-approval$/.test(route) && method === 'PATCH') {
    const campaignId = route.split('/')[2]; if (!state.campaigns.some(row => row.id === campaignId)) throw new Error('Sample campaign was not found.');
    const proposal = { id: id('approval'), kind: 'campaign', status: 'pending', expires_at: new Date(Date.now() + 86400000).toISOString(), payload: { campaign_id: campaignId } };
    state.approvals.unshift(proposal); result = { proposal_id: proposal.id, status: proposal.status, delivery_enabled: false }; changed = true;
  } else if (route === '/purchase-orders' && method === 'GET') result = state.purchaseOrders;
  else if (route === '/purchase-orders' && method === 'POST') {
    const order = { id: id('po'), status: 'draft', created_at: now(), ...body }; state.purchaseOrders.unshift(order);
    const proposal = { id: id('approval'), kind: 'purchase_order', status: 'pending', expires_at: new Date(Date.now() + 86400000).toISOString(), payload: { purchase_order_id: order.id } };
    state.approvals.unshift(proposal); result = { ...order, approval_required: true, proposal_id: proposal.id, submitted: false }; changed = true;
  } else if (route === '/credit/offers') result = [];
  else if (route.startsWith('/tax/summary')) result = { period: url.searchParams.get('period'), taxable_amount: '5600.00', tax_amount: '1008.00', record_count: 4, status: 'draft_summary', filed: false, source: 'fictional sample records' };
  else if (route === '/reports') result = [{ id: 'sample-sales', type: 'sales_summary', available: true, note: 'Fictional sample data' }, { id: 'gst-summary', type: 'gst_draft_summary', available: true }, { id: 'gst-filing', type: 'statutory_filing', available: false, reason: 'No filing provider is configured' }];
  else if (route === '/approvals' && method === 'GET') result = state.approvals;
  else if (route === '/approvals' && method === 'POST') { const proposal = { id: id('approval'), kind: body.kind, status: 'pending', expires_at: new Date(Date.now() + 86400000).toISOString(), payload: body.payload }; state.approvals.unshift(proposal); result = proposal; changed = true; }
  else if (/^\/approvals\/[^/]+\/decision$/.test(route) && method === 'POST') {
    const proposal = state.approvals.find(row => row.id === route.split('/')[2]); if (!proposal) throw new Error('Sample approval was not found.');
    const decision = url.searchParams.get('decision'); proposal.status = decision === 'approve' ? 'approved_pending_provider' : 'rejected';
    result = { id: proposal.id, status: proposal.status, executed: false, message: 'Demo only. No external action was executed.' }; changed = true;
  } else if (route === '/notifications') result = state.notifications;
  else if (/^\/notifications\/[^/]+\/read$/.test(route) && method === 'POST') { const row = state.notifications.find(item => item.id === route.split('/')[2]); if (row) row.read_at = now(); result = { id: row?.id, read: true }; changed = true; }
  else if (route === '/integrations/status') result = [
    { key: 'payments', purpose: 'payment and settlement data', status: 'demo_only', prerequisite: 'Connect an authorized provider for real merchant records.' },
    { key: 'otp', purpose: 'merchant authentication', status: 'demo_only', prerequisite: 'This sample workspace does not authenticate a Paytm account.' },
    { key: 'llm', purpose: 'AI assistant', status: 'demo_only', prerequisite: 'Answers use demo rules and records, not a live AI provider.' },
  ];
  else if (route === '/analytics/period-comparison') result = { current_days: Number(url.searchParams.get('days') ?? 7), current_collections: '4710.00', previous_collections: '1590.00', change_percent: '196.23', comparison_available: true, metric: 'fictional successful collections; not revenue or profit' };
  else if (route === '/analytics/peak-hours') result = { period_days: Number(url.searchParams.get('days') ?? 30), hours: [{ hour: 9, successful_transactions: 8 }, { hour: 13, successful_transactions: 12 }, { hour: 18, successful_transactions: 17 }, { hour: 20, successful_transactions: 11 }], source: 'fictional demo records' };
  else if (route === '/analytics/anomalies') result = { available: true, alerts: [{ type: 'collection_spike', priority: 'medium', change_percent: '196.23', action: 'Sample trend only. Review real records before acting.' }], method: 'sample comparison', collections_are_not_profit: true };
  else if (route === '/conversations' && method === 'POST') { const conversationId = id('conversation'); state.conversations[conversationId] = []; result = { id: conversationId, title: 'Business assistant', created_at: now() }; changed = true; }
  else if (/^\/conversations\/[^/]+\/messages$/.test(route) && method === 'GET') result = state.conversations[route.split('/')[2]] ?? [];
  else if (route === '/assistant/query' && method === 'POST') {
    const conversationId = String(body.conversation_id ?? ''); const history = state.conversations[conversationId] ?? [];
    const question = String(body.question ?? '');
    const answer = /stock|inventory|reorder/i.test(question)
      ? 'In this fictional sample, Masala chai (8 cups) and Samosa (5 pieces) are below their reorder levels. Check real stock before ordering.'
      : /settlement|cash ?flow|payout/i.test(question)
        ? 'The sample workspace shows ₹3,210 pending across one fictional settlement. This is not a real payout or guaranteed receipt.'
        : /sale|collect|today|revenue/i.test(question)
          ? 'The sample workspace shows ₹4,710 in fictional successful collections today, across 5 sample payments, with ₹199 in sample refunds. This is not your real business data or profit.'
          : 'I’m the sample assistant. I can summarize the fictional sales, settlement, and stock records shown in this demo. No Paytm data or live AI provider is connected.';
    history.push({ id: id('message'), role: 'user', content: question, sources: [], created_at: now() }, { id: id('message'), role: 'assistant', content: answer, sources: ['fictional demo records; not live AI'], created_at: now() });
    state.conversations[conversationId] = history; result = { answer, sources: ['fictional demo records; not live AI'], grounded: true }; changed = true;
  }
  else if (route === '/integrations/import/transactions' && method === 'POST') result = { accepted: Array.isArray(body.transactions) ? body.transactions.length : 0, duplicates_skipped: 0, source: 'demo_import', provider_connected: false, message: 'Demo only. No real provider connection was created.' };
  else result = [];

  if (changed) await saveState(state);
  return response<T>(result);
}

export async function enterDemoWorkspace() {
  await SecureStore.setItemAsync('session_token', 'offline-demo-workspace');
}

export const isDemoBuild = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
