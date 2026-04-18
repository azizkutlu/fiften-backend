import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../../../data/ad_spending.json');

function load() {
  if (!existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function save(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function getAllAdSpending() {
  return load();
}

export function addAdSpending(entry) {
  const data = load();
  const record = {
    id: Date.now().toString(),
    platform: entry.platform,   // 'meta' | 'google' | 'tiktok'
    amount: Number(entry.amount),
    currency: entry.currency || 'TRY',
    date: entry.date,           // 'YYYY-MM-DD'
    note: entry.note || '',
    createdAt: new Date().toISOString(),
  };
  data.push(record);
  save(data);
  return record;
}

export function deleteAdSpending(id) {
  const data = load().filter(r => r.id !== id);
  save(data);
}

export function getAdSpendingSummary() {
  const data = load();
  const summary = { meta: 0, google: 0, tiktok: 0, total: 0 };
  for (const r of data) {
    const p = r.platform?.toLowerCase();
    if (p in summary) summary[p] += r.amount;
    summary.total += r.amount;
  }
  return summary;
}

// Son 30 güne göre grupla
export function getAdSpendingByDay(days = 30) {
  const data = load();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const byDay = {};
  for (const r of data) {
    if (new Date(r.date) < cutoff) continue;
    byDay[r.date] = byDay[r.date] || { meta: 0, google: 0, tiktok: 0, total: 0 };
    const p = r.platform?.toLowerCase();
    if (p in byDay[r.date]) byDay[r.date][p] += r.amount;
    byDay[r.date].total += r.amount;
  }
  return byDay;
}
