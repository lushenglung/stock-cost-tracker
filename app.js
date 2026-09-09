import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const configured = !SUPABASE_URL.startsWith('PASTE_') && !SUPABASE_ANON_KEY.startsWith('PASTE_');
const $ = selector => document.querySelector(selector);
const authView = $('#auth-view'), appView = $('#app-view'), tabs = $('#tabs'), stockPanel = $('#stock-panel');
const money = value => `NT$ ${Number(value).toLocaleString('zh-TW', { maximumFractionDigits: 2 })}`;
const today = new Date().toISOString().slice(0, 10);
let supabase, stocks = [], transactions = [], activeStockId = null;

function message(text = '', target = $('#app-message')) { target.textContent = text; }
function escape(text) { return String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
function activeStock() { return stocks.find(stock => stock.id === activeStockId); }
function activeTransactions() { return transactions.filter(row => row.stock_id === activeStockId).sort((a, b) => (a.trade_date || '').localeCompare(b.trade_date || '')); }

function totals(rows) {
  return rows.reduce((result, row) => {
    const amount = Number(row.amount);
    if (row.kind === 'opening' || row.kind === 'buy') { result.held += Number(row.shares); result.netCost += amount; }
    else { result.held -= Number(row.shares); result.netCost -= amount; }
    return result;
  }, { held: 0, netCost: 0 });
}

function render() {
  const stock = activeStock();
  tabs.innerHTML = stocks.map(item => `<button class="tab ${item.id === activeStockId ? 'active' : ''}" data-id="${item.id}">${escape(item.name)}</button>`).join('') + '<button class="tab new" id="new-stock">＋ 新增股票</button>';
  tabs.querySelectorAll('[data-id]').forEach(button => button.onclick = () => { activeStockId = button.dataset.id; message(); render(); });
  $('#new-stock').onclick = () => $('#opening-name').focus();
  stockPanel.hidden = !stock;
  $('#empty-state').hidden = Boolean(stock);
  if (!stock) return;
  $('#stock-title').textContent = stock.name;
  const rows = activeTransactions();
  const { held, netCost } = totals(rows);
  $('#held').textContent = `${held.toLocaleString('zh-TW')} 股`;
  $('#net-cost').textContent = money(netCost);
  $('#breakeven').textContent = held ? money(netCost / held) : '—';
  $('#records').innerHTML = rows.map(row => {
    const opening = row.kind === 'opening';
    const label = opening ? '原有持股' : row.kind === 'buy' ? '買入' : '賣出';
    const amount = Number(row.amount);
    return `<tr><td>${opening ? '原有持股' : row.trade_date}</td><td class="${row.kind === 'sell' ? 'sell' : 'buy'}">${label}</td><td>${Number(row.shares).toLocaleString()}</td><td>${money(row.unit_price)}</td><td>${money(amount)}</td><td><button class="delete-record" data-id="${row.id}">刪除</button></td></tr>`;
  }).join('');
  document.querySelectorAll('.delete-record').forEach(button => button.onclick = async () => {
    const { error } = await supabase.from('transactions').delete().eq('id', button.dataset.id);
    if (error) return message(error.message);
    await loadData();
  });
}

async function loadData() {
  const [stockResult, transactionResult] = await Promise.all([
    supabase.from('stocks').select('*').order('created_at'),
    supabase.from('transactions').select('*').order('trade_date').order('created_at')
  ]);
  if (stockResult.error || transactionResult.error) return message(stockResult.error?.message || transactionResult.error?.message);
  stocks = stockResult.data; transactions = transactionResult.data;
  if (!stocks.some(stock => stock.id === activeStockId)) activeStockId = stocks[0]?.id || null;
  render();
}

async function showApp() {
  authView.hidden = true; appView.hidden = false;
  $('#trade-date').value = today;
  await loadData();
}

async function boot() {
  if (!configured) { $('#auth-message').textContent = '請先依 README 設定 Supabase 網址與匿名金鑰。'; return; }
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { session } } = await supabase.auth.getSession();
  if (session) showApp();
  supabase.auth.onAuthStateChange((_event, session) => session ? showApp() : (authView.hidden = false, appView.hidden = true));
}

$('#login-form').onsubmit = async event => {
  event.preventDefault();
  if (!configured) return;
  const email = $('#email').value.trim();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  $('#auth-message').textContent = error ? error.message : '登入連結已寄出，請到信箱開啟。';
};
$('#signout').onclick = () => supabase.auth.signOut();
$('#opening-form').onsubmit = async event => {
  event.preventDefault(); message();
  const name = $('#opening-name').value.trim(), shares = Number($('#opening-shares').value), totalCost = Number($('#opening-cost').value);
  if (!name || shares <= 0 || totalCost < 0) return message('請完整填寫原有持股。');
  const { data: stock, error } = await supabase.from('stocks').insert({ name }).select().single();
  if (error) return message(error.message);
  const opening = await supabase.from('transactions').insert({ stock_id: stock.id, kind: 'opening', shares, unit_price: totalCost / shares, amount: totalCost });
  if (opening.error) return message(opening.error.message);
  activeStockId = stock.id; event.target.reset(); await loadData();
};
$('#transaction-form').onsubmit = async event => {
  event.preventDefault(); message();
  const kind = $('#trade-type').value, shares = Number($('#trade-shares').value), unitPrice = Number($('#trade-price').value), current = totals(activeTransactions());
  if (!activeStockId || shares <= 0 || unitPrice < 0) return message('請完整填寫交易資料。');
  if (kind === 'sell' && shares > current.held) return message('賣出股數不能超過目前持有股數。');
  const { error } = await supabase.from('transactions').insert({ stock_id: activeStockId, kind, shares, unit_price: unitPrice, amount: shares * unitPrice, trade_date: $('#trade-date').value });
  if (error) return message(error.message);
  $('#trade-shares').value = ''; $('#trade-price').value = ''; await loadData();
};
$('#delete-stock').onclick = async () => {
  const stock = activeStock(); if (!stock || !confirm(`確定刪除 ${stock.name} 與全部紀錄？`)) return;
  const { error } = await supabase.from('stocks').delete().eq('id', stock.id);
  if (error) return message(error.message);
  activeStockId = null; await loadData();
};
boot();
