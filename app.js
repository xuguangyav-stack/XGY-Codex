const storageKey = 'personal-asset-dashboard';

const currency = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 2,
});

const today = new Date().toISOString().slice(0, 10);

const state = loadState();

const els = {
  totalAssets: document.querySelector('#total-assets'),
  totalLiabilities: document.querySelector('#total-liabilities'),
  netWorth: document.querySelector('#net-worth'),
  monthlyBalance: document.querySelector('#monthly-balance'),
  accountList: document.querySelector('#account-list'),
  transactionList: document.querySelector('#transaction-list'),
  goalList: document.querySelector('#goal-list'),
  allocationChart: document.querySelector('#allocation-chart'),
  insights: document.querySelector('#insights'),
  accountForm: document.querySelector('#account-form'),
  transactionForm: document.querySelector('#transaction-form'),
  goalForm: document.querySelector('#goal-form'),
  seedDemo: document.querySelector('#seed-demo'),
  resetData: document.querySelector('#reset-data'),
};

document.querySelector('input[name="date"]').value = today;
document.querySelector('input[name="deadline"]').value = today;

els.accountForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.accounts.unshift({
    id: crypto.randomUUID(),
    name: formData.get('name').trim(),
    type: formData.get('type'),
    category: formData.get('category'),
    amount: Number(formData.get('amount')),
  });
  event.currentTarget.reset();
  persistAndRender();
});

els.transactionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.transactions.unshift({
    id: crypto.randomUUID(),
    note: formData.get('note').trim(),
    type: formData.get('type'),
    category: formData.get('category').trim(),
    amount: Number(formData.get('amount')),
    date: formData.get('date'),
  });
  event.currentTarget.reset();
  document.querySelector('input[name="date"]').value = today;
  persistAndRender();
});

els.goalForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  state.goals.unshift({
    id: crypto.randomUUID(),
    name: formData.get('name').trim(),
    target: Number(formData.get('target')),
    saved: Number(formData.get('saved')),
    deadline: formData.get('deadline'),
  });
  event.currentTarget.reset();
  document.querySelector('input[name="deadline"]').value = today;
  persistAndRender();
});

els.seedDemo.addEventListener('click', () => {
  Object.assign(state, demoState());
  persistAndRender();
});

els.resetData.addEventListener('click', () => {
  if (!window.confirm('确定要清空所有本地资产数据吗？')) return;
  Object.assign(state, { accounts: [], transactions: [], goals: [] });
  persistAndRender();
});

render();

function loadState() {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { accounts: [], transactions: [], goals: [] };
    const parsed = JSON.parse(raw);
    return {
      accounts: parsed.accounts ?? [],
      transactions: parsed.transactions ?? [],
      goals: parsed.goals ?? [],
    };
  } catch {
    return { accounts: [], transactions: [], goals: [] };
  }
}

function persistAndRender() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  render();
}

function render() {
  renderSummary();
  renderAccounts();
  renderTransactions();
  renderGoals();
  renderAllocation();
  renderInsights();
}

function renderSummary() {
  const accounts = state.accounts;
  const totalAssets = sum(accounts.filter((item) => item.type === 'asset').map((item) => item.amount));
  const totalLiabilities = sum(accounts.filter((item) => item.type === 'liability').map((item) => item.amount));
  const netWorth = totalAssets - totalLiabilities;
  const monthPrefix = today.slice(0, 7);
  const monthlyIncome = sum(state.transactions.filter((item) => item.type === 'income' && item.date.startsWith(monthPrefix)).map((item) => item.amount));
  const monthlyExpense = sum(state.transactions.filter((item) => item.type === 'expense' && item.date.startsWith(monthPrefix)).map((item) => item.amount));

  els.totalAssets.textContent = currency.format(totalAssets);
  els.totalLiabilities.textContent = currency.format(totalLiabilities);
  els.netWorth.textContent = currency.format(netWorth);
  els.monthlyBalance.textContent = currency.format(monthlyIncome - monthlyExpense);
}

function renderAccounts() {
  renderList({
    container: els.accountList,
    items: state.accounts,
    templateId: 'account-item-template',
    fill: (fragment, item) => {
      fragment.querySelector('h3').textContent = item.name;
      fragment.querySelector('.meta').textContent = `${item.type === 'asset' ? '资产' : '负债'} · ${item.category}`;
      fragment.querySelector('strong').textContent = currency.format(item.amount);
      fragment.querySelector('button').addEventListener('click', () => removeItem('accounts', item.id));
    },
  });
}

function renderTransactions() {
  renderList({
    container: els.transactionList,
    items: state.transactions,
    templateId: 'transaction-item-template',
    fill: (fragment, item) => {
      fragment.querySelector('h3').textContent = item.note;
      fragment.querySelector('.meta').textContent = `${item.category} · ${item.date}`;
      fragment.querySelector('strong').textContent = `${item.type === 'income' ? '+' : '-'} ${currency.format(item.amount)}`;
      fragment.querySelector('strong').style.color = item.type === 'income' ? '#86efac' : '#fda4af';
      fragment.querySelector('button').addEventListener('click', () => removeItem('transactions', item.id));
    },
  });
}

function renderGoals() {
  renderList({
    container: els.goalList,
    items: state.goals,
    templateId: 'goal-item-template',
    fill: (fragment, item) => {
      const progress = item.target ? Math.min((item.saved / item.target) * 100, 100) : 0;
      fragment.querySelector('h3').textContent = item.name;
      fragment.querySelector('.meta').textContent = `截止日期：${item.deadline}`;
      fragment.querySelector('.progress-bar span').style.width = `${progress}%`;
      fragment.querySelector('strong').textContent = `${currency.format(item.saved)} / ${currency.format(item.target)}`;
      fragment.querySelector('.goal-percent').textContent = `${progress.toFixed(1)}%`;
      fragment.querySelector('button').addEventListener('click', () => removeItem('goals', item.id));
    },
  });
}

function renderAllocation() {
  const assetAccounts = state.accounts.filter((item) => item.type === 'asset');
  const totalAssets = sum(assetAccounts.map((item) => item.amount));
  els.allocationChart.innerHTML = '';

  if (!assetAccounts.length || totalAssets <= 0) {
    els.allocationChart.classList.add('empty-state');
    return;
  }

  els.allocationChart.classList.remove('empty-state');

  const groups = Object.entries(
    assetAccounts.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + item.amount;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  groups.forEach(([category, amount]) => {
    const row = document.createElement('div');
    row.className = 'allocation-row';
    const percent = amount / totalAssets * 100;
    row.innerHTML = `
      <span>${category}</span>
      <div class="allocation-track"><span style="width:${percent}%"></span></div>
      <strong>${percent.toFixed(1)}%</strong>
    `;
    els.allocationChart.appendChild(row);
  });
}

function renderInsights() {
  els.insights.innerHTML = '';
  const cards = buildInsights();
  cards.forEach((card) => {
    const node = document.createElement('article');
    node.className = 'insight-card';
    node.innerHTML = `<strong>${card.title}</strong><p>${card.description}</p>`;
    els.insights.appendChild(node);
  });
}

function buildInsights() {
  const insights = [];
  const assetAccounts = state.accounts.filter((item) => item.type === 'asset');
  const liabilityAccounts = state.accounts.filter((item) => item.type === 'liability');
  const cash = sum(assetAccounts.filter((item) => ['现金', '储蓄'].includes(item.category)).map((item) => item.amount));
  const liabilities = sum(liabilityAccounts.map((item) => item.amount));
  const monthlyIncome = sum(state.transactions.filter((item) => item.type === 'income').map((item) => item.amount));
  const monthlyExpense = sum(state.transactions.filter((item) => item.type === 'expense').map((item) => item.amount));
  const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;
  const emergencyMonths = monthlyExpense > 0 ? cash / (monthlyExpense || 1) : 0;

  insights.push({
    title: '储蓄率',
    description: monthlyIncome > 0
      ? `当前记录周期的储蓄率约为 ${savingsRate.toFixed(1)}%。如果能稳定高于 20%，通常更有利于建立长期安全边际。`
      : '先记录几笔收入与支出，系统会自动估算你的储蓄率。',
  });

  insights.push({
    title: '应急资金',
    description: monthlyExpense > 0
      ? `当前现金与储蓄约可覆盖 ${emergencyMonths.toFixed(1)} 个月支出。一般建议准备 3 到 6 个月生活费作为应急资金。`
      : '补充支出记录后，这里会估算你的应急金覆盖月数。',
  });

  insights.push({
    title: '负债观察',
    description: liabilities > 0
      ? `你当前记录的负债为 ${currency.format(liabilities)}。建议优先关注高利率负债，并制定固定的提前还款计划。`
      : '当前没有记录负债，资产结构相对更轻盈。记得定期复盘信用卡和贷款情况。',
  });

  if (state.goals.length) {
    const nearestGoal = [...state.goals].sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
    const remaining = Math.max(nearestGoal.target - nearestGoal.saved, 0);
    insights.push({
      title: '最近目标',
      description: `距离“${nearestGoal.name}”目标还差 ${currency.format(remaining)}，截止日期是 ${nearestGoal.deadline}。建议把该目标拆分为每月固定存入计划。`,
    });
  }

  return insights;
}

function renderList({ container, items, templateId, fill }) {
  container.innerHTML = '';
  if (!items.length) {
    container.classList.add('empty-state');
    return;
  }

  container.classList.remove('empty-state');
  const template = document.querySelector(`#${templateId}`);
  items.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    fill(fragment, item);
    container.appendChild(fragment);
  });
}

function removeItem(key, id) {
  state[key] = state[key].filter((item) => item.id !== id);
  persistAndRender();
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function demoState() {
  return {
    accounts: [
      { id: crypto.randomUUID(), name: '招商银行活期', type: 'asset', category: '现金', amount: 28600 },
      { id: crypto.randomUUID(), name: '指数基金账户', type: 'asset', category: '基金', amount: 72000 },
      { id: crypto.randomUUID(), name: '港股账户', type: 'asset', category: '股票', amount: 35600 },
      { id: crypto.randomUUID(), name: '房贷', type: 'liability', category: '贷款', amount: 420000 },
    ],
    transactions: [
      { id: crypto.randomUUID(), note: '月度工资', type: 'income', category: '工资', amount: 18000, date: today },
      { id: crypto.randomUUID(), note: '基金定投', type: 'expense', category: '投资', amount: 3000, date: today },
      { id: crypto.randomUUID(), note: '房租与生活费', type: 'expense', category: '生活', amount: 6500, date: today },
    ],
    goals: [
      { id: crypto.randomUUID(), name: '应急资金', target: 60000, saved: 28000, deadline: '2026-12-31' },
      { id: crypto.randomUUID(), name: '年度旅行基金', target: 15000, saved: 4500, deadline: '2026-08-01' },
    ],
  };
}
