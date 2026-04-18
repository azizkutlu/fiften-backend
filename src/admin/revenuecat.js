// RevenueCat REST API v2
const RC_API_KEY = process.env.REVENUECAT_SECRET_KEY || '';
const BASE = 'https://api.revenuecat.com/v2';

async function rcFetch(path) {
  if (!RC_API_KEY) return null;
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${RC_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

// Genel uygulama metrikleri (RevenueCat Overview)
export async function getOverview(projectId) {
  if (!projectId) return null;
  return rcFetch(`/projects/${projectId}/metrics/overview`);
}

// Aktif abonelikler
export async function getActiveSubscribers(projectId) {
  if (!projectId) return null;
  return rcFetch(`/projects/${projectId}/metrics/active_subscriptions`);
}

// Son N günlük MRR ve gelir zaman serisi
export async function getRevenueSeries(projectId, days = 30) {
  if (!projectId) return null;
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  return rcFetch(`/projects/${projectId}/metrics/charts/revenue?start_time=${start}&end_time=${end}&resolution=day`);
}
