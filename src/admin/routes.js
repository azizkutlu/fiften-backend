import { Router } from 'express';
import { adminLogin, requireAdmin, hashPassword } from './auth.js';
import { getDb } from './firebase.js';
import {
  getOverview,
  getActiveSubscribers,
  getRevenueSeries,
  getMrrSeries,
  getChurnSeries,
  normalizeOverviewMetrics,
} from './revenuecat.js';
import {
  getAllAdSpending, addAdSpending, deleteAdSpending,
  getAdSpendingSummary, getAdSpendingByDay
} from './adSpending.js';

const router = Router();
const RC_PROJECT_ID = process.env.REVENUECAT_PROJECT_ID || '';

function toIso(ts) {
  return ts?.toDate?.()?.toISOString?.() || null;
}

function readMetricValue(metrics, ids) {
  for (const id of ids) {
    const value = metrics?.[id]?.value;
    if (typeof value === 'number') return value;
  }
  return null;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });
  const token = await adminLogin(username, password);
  if (!token) return res.status(401).json({ error: 'Invalid credentials' });
  res.json({ token });
});

// Hash üretici (geliştirme aracı — kullanıcı eklemek için)
router.post('/hash', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Missing password' });
  const hash = await hashPassword(password);
  res.json({ hash });
});

// ── Dashboard Ana Metrikler ───────────────────────────────────────────────────

router.get('/metrics/overview', requireAdmin, async (req, res) => {
  const db = getDb();
  const [rcOverview, rcSubscribers] = await Promise.allSettled([
    getOverview(RC_PROJECT_ID),
    getActiveSubscribers(RC_PROJECT_ID),
  ]);

  const adSummary = getAdSpendingSummary();
  let firestoreData = null;
  let recentActivity = {
    instagram: [],
    whatsapp: [],
    totals: {
      instagramHistoryCount: 0,
      whatsappHistoryCount: 0,
    },
  };

  if (db) {
    try {
      const usersSnap = await db.collection('users').get();
      let totalUsers = 0;
      let premiumUsers = 0;
      let totalAnalyses = 0;
      const now = Date.now();
      const day7 = now - 7 * 86400000;
      const day30 = now - 30 * 86400000;
      let activeWeek = 0, activeMonth = 0;
      const planDistribution = {};

      for (const doc of usersSnap.docs) {
        totalUsers++;
        const d = doc.data();
        if (d.isPremium) premiumUsers++;
        if (d.lastActiveAt?.toMillis?.() > day7) activeWeek++;
        if (d.lastActiveAt?.toMillis?.() > day30) activeMonth++;
        if (typeof d.totalAnalyses === 'number') totalAnalyses += d.totalAnalyses;
        const planCode = (d.premiumPlanCode || 'free').toString();
        planDistribution[planCode] = (planDistribution[planCode] || 0) + 1;
      }

      // Günlük yeni kullanıcılar (son 30 gün)
      const newUsersByDay = {};
      for (const doc of usersSnap.docs) {
        const d = doc.data();
        const ts = d.createdAt?.toDate?.();
        if (!ts) continue;
        if (now - ts.getTime() > 30 * 86400000) continue;
        const key = ts.toISOString().split('T')[0];
        newUsersByDay[key] = (newUsersByDay[key] || 0) + 1;
      }

      let instagramHistoryCount = 0;
      let whatsappHistoryCount = 0;
      let recentInstagram = [];
      let recentWhatsApp = [];

      try {
        const [igCountSnap, waCountSnap, igRecentSnap, waRecentSnap] =
          await Promise.all([
            db.collectionGroup('instagram_history').count().get(),
            db.collectionGroup('whatsapp_history').count().get(),
            db
              .collectionGroup('instagram_history')
              .orderBy('timestamp', 'desc')
              .limit(10)
              .get(),
            db
              .collectionGroup('whatsapp_history')
              .orderBy('timestamp', 'desc')
              .limit(10)
              .get(),
          ]);

        instagramHistoryCount = igCountSnap.data().count || 0;
        whatsappHistoryCount = waCountSnap.data().count || 0;

        recentInstagram = igRecentSnap.docs.map((doc) => {
          const parentUser = doc.ref.parent.parent;
          const data = doc.data();
          return {
            id: doc.id,
            userUid: parentUser?.id || '',
            username: data.username || '',
            fullName: data.fullName || '',
            profilePictureUrl: data.profilePictureUrl || '',
            mediaCount: data.mediaCount || 0,
            timestamp: toIso(data.timestamp),
          };
        });

        recentWhatsApp = waRecentSnap.docs.map((doc) => {
          const parentUser = doc.ref.parent.parent;
          const data = doc.data();
          return {
            id: doc.id,
            userUid: parentUser?.id || '',
            name: data.name || '',
            number: data.number || '',
            timestamp: toIso(data.timestamp),
          };
        });
      } catch (e) {
        console.error('[Admin] Firestore activity error:', e.message);
      }

      firestoreData = {
        totalUsers,
        premiumUsers,
        totalAnalyses,
        activeWeek,
        activeMonth,
        newUsersByDay,
        planDistribution,
      };

      recentActivity = {
        instagram: recentInstagram,
        whatsapp: recentWhatsApp,
        totals: {
          instagramHistoryCount,
          whatsappHistoryCount,
        },
      };
    } catch (e) {
      console.error('[Admin] Firestore error:', e.message);
    }
  }

  const revenuecatOverview =
    rcOverview.status === 'fulfilled' && rcOverview.value
      ? normalizeOverviewMetrics(rcOverview.value)
      : null;

  res.json({
    firestore: firestoreData,
    revenuecat: {
      overview: revenuecatOverview,
      subscribers: rcSubscribers.status === 'fulfilled' ? rcSubscribers.value : null,
      summary: revenuecatOverview
        ? {
            mrr: readMetricValue(revenuecatOverview, ['mrr']),
            revenue28d: readMetricValue(revenuecatOverview, ['revenue']),
            activeSubscriptions: readMetricValue(revenuecatOverview, [
              'active_subscriptions',
            ]),
            activeTrials: readMetricValue(revenuecatOverview, ['active_trials']),
            activeUsers28d: readMetricValue(revenuecatOverview, [
              'active_users',
            ]),
            newCustomers28d: readMetricValue(revenuecatOverview, [
              'new_customers',
            ]),
          }
        : null,
    },
    adSpending: adSummary,
    activity: recentActivity,
  });
});

// Gelir zaman serisi
router.get('/metrics/revenue', requireAdmin, async (req, res) => {
  const days = Number(req.query.days) || 30;
  const [revenue, mrr, churn] = await Promise.all([
    getRevenueSeries(RC_PROJECT_ID, days),
    getMrrSeries(RC_PROJECT_ID, days),
    getChurnSeries(RC_PROJECT_ID, days),
  ]);
  res.json({ revenue, mrr, churn });
});

// Kullanıcı listesi
router.get('/users', requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ users: [] });
  try {
    const limit = Number(req.query.limit) || 50;
    const snap = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    const users = snap.docs.map(doc => {
      const d = doc.data();
      return {
        uid: doc.id,
        appUserId: d.appUserId || '',
        email: d.email || '',
        displayName: d.displayName || '',
        isPremium: d.isPremium || false,
        premiumPlanCode: d.premiumPlanCode || 'free',
        premiumPlanTitle: d.premiumPlanTitle || '',
        premiumActivatedAt: d.premiumActivatedAt?.toDate?.()?.toISOString() || null,
        createdAt: d.createdAt?.toDate?.()?.toISOString() || null,
        lastActiveAt: d.lastActiveAt?.toDate?.()?.toISOString() || null,
        totalAnalyses: d.totalAnalyses || 0,
      };
    });
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Premium kullanıcı listesi
router.get('/users/premium', requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ users: [] });
  try {
    const snap = await db.collection('users')
      .where('isPremium', '==', true)
      .orderBy('premiumActivatedAt', 'desc')
      .get();
    const users = snap.docs.map(doc => {
      const d = doc.data();
      return {
        uid: doc.id,
        appUserId: d.appUserId || '',
        email: d.email || '',
        displayName: d.displayName || '',
        premiumPlanCode: d.premiumPlanCode || 'free',
        premiumPlanTitle: d.premiumPlanTitle || '',
        premiumActivatedAt: d.premiumActivatedAt?.toDate?.()?.toISOString() || null,
        premiumRenewalType: d.premiumRenewalType || '',
        premiumPriceLabel: d.premiumPriceLabel || '',
      };
    });
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/activity/recent', requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) {
    return res.json({
      instagram: [],
      whatsapp: [],
      totals: {
        instagramHistoryCount: 0,
        whatsappHistoryCount: 0,
      },
    });
  }

  try {
    const [igCountSnap, waCountSnap, igRecentSnap, waRecentSnap] =
      await Promise.all([
        db.collectionGroup('instagram_history').count().get(),
        db.collectionGroup('whatsapp_history').count().get(),
        db
          .collectionGroup('instagram_history')
          .orderBy('timestamp', 'desc')
          .limit(20)
          .get(),
        db
          .collectionGroup('whatsapp_history')
          .orderBy('timestamp', 'desc')
          .limit(20)
          .get(),
      ]);

    res.json({
      instagram: igRecentSnap.docs.map((doc) => {
        const parentUser = doc.ref.parent.parent;
        const d = doc.data();
        return {
          id: doc.id,
          userUid: parentUser?.id || '',
          username: d.username || '',
          fullName: d.fullName || '',
          profilePictureUrl: d.profilePictureUrl || '',
          mediaCount: d.mediaCount || 0,
          timestamp: toIso(d.timestamp),
        };
      }),
      whatsapp: waRecentSnap.docs.map((doc) => {
        const parentUser = doc.ref.parent.parent;
        const d = doc.data();
        return {
          id: doc.id,
          userUid: parentUser?.id || '',
          name: d.name || '',
          number: d.number || '',
          timestamp: toIso(d.timestamp),
        };
      }),
      totals: {
        instagramHistoryCount: igCountSnap.data().count || 0,
        whatsappHistoryCount: waCountSnap.data().count || 0,
      },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Ad Spending ───────────────────────────────────────────────────────────────

router.get('/ads', requireAdmin, (req, res) => {
  const days = Number(req.query.days) || 30;
  res.json({
    entries: getAllAdSpending().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200),
    byDay: getAdSpendingByDay(days),
    summary: getAdSpendingSummary(),
  });
});

router.post('/ads', requireAdmin, (req, res) => {
  const { platform, amount, currency, date, note } = req.body;
  if (!platform || !amount || !date) return res.status(400).json({ error: 'Missing fields' });
  const record = addAdSpending({ platform, amount, currency, date, note });
  res.json({ record });
});

router.delete('/ads/:id', requireAdmin, (req, res) => {
  deleteAdSpending(req.params.id);
  res.json({ ok: true });
});

export default router;
