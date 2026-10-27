(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MomentaFinance = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function budgetForMonth(overrides = {}, templates = {}, month) {
    const monthRows = overrides && typeof overrides[month] === 'object' ? overrides[month] : {};
    return [...new Set([...Object.keys(templates || {}), ...Object.keys(monthRows || {})])].map(category => {
      const hasOverride = Object.prototype.hasOwnProperty.call(monthRows, category);
      return { category, amount: Math.max(0, Number(hasOverride ? monthRows[category] : templates[category]) || 0), source: hasOverride ? 'override' : 'template' };
    }).filter(row => row.amount > 0);
  }
  function reconcileAccountBalances(accounts = [], expenses = []) {
    return accounts.map(account => {
      const currentBalance = expenses.filter(row => String(row.accountId || '') === String(account.id || '')).reduce((balance, row) => {
        const amount = Math.max(0, Number(row.amount) || 0);
        return balance + (row.type === 'income' ? amount : -amount);
      }, Number(account.startingBalance) || 0);
      return { ...account, currentBalance: Math.round(currentBalance * 100) / 100 };
    });
  }
  function investmentSummary(assets = []) {
    const value = assets.reduce((sum, asset) => sum + Math.max(0, Number(asset.value) || 0), 0);
    const cost = assets.reduce((sum, asset) => sum + Math.max(0, Number(asset.cost) || 0), 0);
    return { value: Math.round(value * 100) / 100, cost: Math.round(cost * 100) / 100, change: Math.round((value - cost) * 100) / 100, allocationTotal: value > 0 ? 100 : 0 };
  }
  function createBillExpense(bill, month, date, confirmed) {
    if (!confirmed || !bill || !bill.id || !/^\d{4}-\d{2}$/.test(String(month)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return null;
    if ((Array.isArray(bill.paidMonths) ? bill.paidMonths : []).includes(month)) return null;
    const amount = Number(bill.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !bill.name) return null;
    return { id: `recurring_${String(bill.id)}_${month}`, type: 'expense', amount, category: String(bill.category || 'bills'), date, note: String(bill.name), accountId: String(bill.accountId || '') };
  }
  return { budgetForMonth, reconcileAccountBalances, investmentSummary, createBillExpense };
});
