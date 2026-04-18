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

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(
      `[RevenueCat] ${res.status} ${res.statusText} for ${path}${
        body ? ` — ${body.slice(0, 300)}` : ''
      }`
    );
    return null;
  }

  return res.json();
}

function buildDateRange(days = 30) {
  const endDate = new Date();
  const startDate = new Date(Date.now() - (days - 1) * 86400000);
  return {
    end: endDate.toISOString().split('T')[0],
    start: startDate.toISOString().split('T')[0],
  };
}

export function normalizeOverviewMetrics(payload) {
  const metrics = payload?.metrics || [];
  const normalized = {};

  for (const metric of metrics) {
    if (!metric?.id) continue;
    normalized[metric.id] = {
      id: metric.id,
      name: metric.name,
      description: metric.description || '',
      unit: metric.unit || '',
      period: metric.period || '',
      value: metric.value ?? 0,
      lastUpdatedAt: metric.last_updated_at || null,
      lastUpdatedAtIso:
        metric.last_updated_at_iso8601 || null,
    };
  }

  return normalized;
}

function normalizeChartValues(payload) {
  const values = payload?.values || payload?.data || [];

  return values.map((point) => ({
    timestamp:
      point.timestamp ||
      point.date ||
      point.time ||
      point.label ||
      null,
    value:
      point.value ??
      point.count ??
      point.amount ??
      point.revenue ??
      0,
  }));
}

// Genel uygulama metrikleri (RevenueCat Overview)
export async function getOverview(projectId) {
  if (!projectId) return null;
  return rcFetch(`/projects/${projectId}/metrics/overview`);
}

// Legacy endpoint; nullable is okay if account/permissions differ.
export async function getActiveSubscribers(projectId) {
  if (!projectId) return null;
  return rcFetch(`/projects/${projectId}/metrics/active_subscriptions`);
}

export async function getChart(projectId, chartName, days = 30) {
  if (!projectId) return null;

  const { start, end } = buildDateRange(days);
  const payload = await rcFetch(
    `/projects/${projectId}/charts/${chartName}?start_time=${start}&end_time=${end}&resolution=day`
  );

  if (!payload) return null;

  return {
    chart: chartName,
    startDate: payload.start_date || start,
    endDate: payload.end_date || end,
    summary: payload.summary || null,
    values: normalizeChartValues(payload),
    raw: payload,
  };
}

// Son N günlük gelir zaman serisi
export async function getRevenueSeries(projectId, days = 30) {
  return getChart(projectId, 'revenue', days);
}

export async function getMrrSeries(projectId, days = 30) {
  return getChart(projectId, 'mrr', days);
}

export async function getChurnSeries(projectId, days = 30) {
  return getChart(projectId, 'churn', days);
}
