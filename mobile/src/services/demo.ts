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

function inr(value: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

function demoAssistantAnswer(question: string, state: DemoState): { answer: string; sources: string[] } {
  const q = question.toLocaleLowerCase('en-IN');
  const source = ['fictional sample records'];
  const hour = 60 * 60 * 1000;
  const nowMs = Date.now();
  const days = /(?:last|past|previous)\s*(?:7|seven)\s*days|last week|this week/.test(q) ? 7
    : /(?:last|past|previous)\s*(?:30|thirty)\s*days|last month|this month/.test(q) ? 30
      : /yesterday/.test(q) ? 2 : 1;
  const startMs = nowMs - days * 24 * hour;
  const transactions = state.transactions.filter(tx => new Date(tx.occurred_at).getTime() >= startMs);
  const successful = transactions.filter(tx => tx.status === 'succeeded');
  const collected = successful.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const refunds = transactions.filter(tx => tx.status === 'refunded')
    .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
  const period = days === 1 ? 'the last 24 hours' : days === 2 ? 'the last 24 hours ending yesterday' : `the last ${days} days`;

  if (/profit|margin|net income|earnings after cost/.test(q)) {
    return { answer: 'I can’t calculate profit or margin from these sample payment records. They do not include costs, refunds by item, taxes, or operating expenses.', sources: source };
  }

  if (/\b(stock|inventory|reorder|product|products)\b/.test(q)) {
    const matching = state.products.filter(product => q.includes(String(product.name).toLocaleLowerCase('en-IN')));
    const items = matching.length ? matching : state.products;
    if (/low|below|reorder|running out|need to order/.test(q)) {
      const low = items.filter(product => Number(product.quantity) <= Number(product.reorder_level));
      if (!low.length) return { answer: matching.length ? `${matching[0].name} is above its reorder level in the sample records (${matching[0].quantity} ${matching[0].unit}; reorder at ${matching[0].reorder_level}).` : 'No sample products are at or below their reorder levels.', sources: source };
      return { answer: `In the sample records, ${low.map(product => `${product.name} has ${product.quantity} ${product.unit} (reorder level ${product.reorder_level})`).join('; ')}.`, sources: source };
    }
    return { answer: `Sample stock: ${items.map(product => `${product.name}: ${product.quantity} ${product.unit} (reorder at ${product.reorder_level})`).join('; ')}.`, sources: source };
  }

  if (/settlement|cash ?flow|payout/.test(q)) {
    const pending = state.settlements.filter(item => item.status === 'pending');
    const total = pending.reduce((sum, item) => sum + Number(item.amount), 0);
    return { answer: `The fictional sample records show ${inr(total)} pending across ${pending.length} settlements. That is a recorded status, not a guaranteed receipt or date.`, sources: source };
  }

  if (/refund|returned payment/.test(q)) {
    return { answer: `The fictional sample records show ${inr(refunds)} in refunds during ${period}.`, sources: source };
  }

  if (/\b(up[iy]|cash|card|payment method|payment type)\b/.test(q)) {
    const methods = new Map<string, { count: number; amount: number }>();
    for (const tx of successful) {
      const method = String(tx.payment_method ?? 'unknown').toUpperCase();
      const summary = methods.get(method) ?? { count: 0, amount: 0 };
      summary.count += 1;
      summary.amount += Number(tx.amount);
      methods.set(method, summary);
    }
    const breakdown = [...methods.entries()].map(([method, summary]) => `${method}: ${inr(summary.amount)} (${summary.count} payments)`);
    return { answer: breakdown.length ? `Successful sample payments in ${period}: ${breakdown.join('; ')}.` : `There are no successful sample payments in ${period}.`, sources: source };
  }

  if (/\b(sale|sales|collect|collection|revenue|payment|transaction|transactions)\b/.test(q)) {
    if (/compare|versus|\bvs\b|change|trend/.test(q) && days === 7) {
      const previousStart = startMs - 7 * 24 * hour;
      const previous = state.transactions.filter(tx => {
        const date = new Date(tx.occurred_at).getTime();
        return date >= previousStart && date < startMs && tx.status === 'succeeded';
      }).reduce((sum, tx) => sum + Number(tx.amount), 0);
      const difference = collected - previous;
      return { answer: `For the fictional sample records, successful collections were ${inr(collected)} in the last 7 days and ${inr(previous)} in the 7 days before that (${difference >= 0 ? 'up' : 'down'} ${inr(Math.abs(difference))}). These are collections, not profit.`, sources: source };
    }
    return { answer: `The fictional sample records show ${inr(collected)} in successful collections across ${successful.length} payments during ${period}, with ${inr(refunds)} in refunds. Collections are not profit.`, sources: source };
  }

  if (/\bcustomer|customers|marketing consent|opted.?in\b/.test(q)) {
    const optedIn = state.customers.filter(customer => customer.consent_marketing).length;
    return { answer: `The sample workspace has ${state.customers.length} fictional customer records; ${optedIn} are marked as opted in to marketing. Verify consent before contacting anyone.`, sources: source };
  }

  if (/campaign|promotion|offer/.test(q)) {
    return { answer: state.campaigns.length
      ? `There are ${state.campaigns.length} fictional sample campaign${state.campaigns.length === 1 ? '' : 's'}: ${state.campaigns.map(campaign => `${campaign.name} (${campaign.status})`).join('; ')}. No messages are sent from this demo.`
      : 'There are no campaigns in the fictional sample workspace.', sources: source };
  }

  if (/supplier|vendor/.test(q)) {
    return { answer: state.suppliers.length
      ? `Sample suppliers: ${state.suppliers.map(supplier => `${supplier.name}${supplier.active ? ' (active)' : ' (inactive)'}`).join('; ')}.`
      : 'There are no suppliers in the fictional sample workspace.', sources: source };
  }

  if (/what should i focus|what should i do|any advice|next step|help me improve/.test(q)) {
    const low = state.products.filter(product => Number(product.quantity) <= Number(product.reorder_level));
    const pending = state.settlements.filter(item => item.status === 'pending');
    const nextSteps = [
      ...low.map(product => `review stock for ${product.name} (${product.quantity} ${product.unit}; reorder level ${product.reorder_level})`),
      ...(pending.length ? [`check the status of ${pending.length} pending sample settlement${pending.length === 1 ? '' : 's'}`] : []),
    ];
    return { answer: nextSteps.length
      ? `Based on the fictional sample records, useful checks are: ${nextSteps.join('; ')}. Confirm these against your real business records before acting.`
      : 'The fictional sample records show no low-stock items or pending settlements to flag. Check the real dashboard for current priorities.', sources: source };
  }

  return { answer: 'I can answer questions about sample collections and refunds, payment methods, pending settlements, stock and reorder levels, customers’ recorded marketing consent, and campaigns. This offline workspace uses fictional records and has no live generative AI provider connected.', sources: source };
}

export async function demoApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(path, 'https://offline.demo');
  const route = url.pathname;
  const method = (init.method ?? 'GET').toUpperCase();
  const body = init.body ? JSON.parse(String(init.body)) as DemoRecord : {};
  const state = await loadState();
  let result: unknown;
  let changed = false;

  if (route === '/dashboard/sales') {
    result = { currency: 'INR', collection_total: '2650.00', successful_transactions: 3, refunds_total: '199.00', pending_settlements: '3210.00', source: 'fictional demo records', as_of: now(), data_available: true };
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
  else if (route === '/analytics/period-comparison') result = { current_days: Number(url.searchParams.get('days') ?? 7), current_collections: '2650.00', previous_collections: '2060.00', change_percent: '28.64', comparison_available: true, metric: 'fictional successful collections; not revenue or profit' };
  else if (route === '/analytics/peak-hours') result = { period_days: Number(url.searchParams.get('days') ?? 30), hours: [{ hour: 9, successful_transactions: 8 }, { hour: 13, successful_transactions: 12 }, { hour: 18, successful_transactions: 17 }, { hour: 20, successful_transactions: 11 }], source: 'fictional demo records' };
  else if (route === '/analytics/anomalies') result = { available: true, alerts: [], method: 'sample comparison; no alert threshold crossed', collections_are_not_profit: true };
  else if (route === '/conversations' && method === 'POST') { const conversationId = id('conversation'); state.conversations[conversationId] = []; result = { id: conversationId, title: 'Business assistant', created_at: now() }; changed = true; }
  else if (/^\/conversations\/[^/]+\/messages$/.test(route) && method === 'GET') result = state.conversations[route.split('/')[2]] ?? [];
  else if (route === '/assistant/query' && method === 'POST') {
    const conversationId = String(body.conversation_id ?? ''); const history = state.conversations[conversationId] ?? [];
    const question = String(body.question ?? '');
    const { answer, sources } = demoAssistantAnswer(question, state);
    history.push({ id: id('message'), role: 'user', content: question, sources: [], created_at: now() }, { id: id('message'), role: 'assistant', content: answer, sources, created_at: now() });
    state.conversations[conversationId] = history; result = { answer, sources, grounded: true }; changed = true;
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
