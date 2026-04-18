import { Router } from 'express';
import { adminLogin, requireAdmin, hashPassword } from './auth.js';
import { getDb } from './firebase.js';
import { getOverview, getActiveSubscribers, getRevenueSeries } from './revenuecat.js';
import {
  getAllAdSpending, addAdSpending, deleteAdSpending,
  getAdSpendingSummary, getAdSpendingByDay
} from './adSpending.js';

const router = Router();
const RC_PROJECT_ID = process.env.REVENUECAT_PROJECT_ID || '';

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

  if (db) {
    try {
      const usersSnap = await db.collection('users').get();
      let totalUsers = 0, premiumUsers = 0, totalAnalyses = 0;
      const now = Date.now();
      const day7 = now - 7 * 86400000;
      const day30 = now - 30 * 86400000;
      let activeWeek = 0, activeMonth = 0;

      for (const doc of usersSnap.docs) {
        totalUsers++;
        const d = doc.data();
        if (d.isPremium) premiumUsers++;
        if (d.lastActiveAt?.toMillis?.() > day7) activeWeek++;
        if (d.lastActiveAt?.toMillis?.() > day30) activeMonth++;
        if (typeof d.totalAnalyses === 'number') totalAnalyses += d.totalAnalyses;
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

      firestoreData = { totalUsers, premiumUsers, totalAnalyses, activeWeek, activeMonth, newUsersByDay };
    } catch (e) {
      console.error('[Admin] Firestore error:', e.message);
    }
  }

  res.json({
    firestore: firestoreData,
    revenuecat: {
      overview: rcOverview.status === 'fulfilled' ? rcOverview.value : null,
      subscribers: rcSubscribers.status === 'fulfilled' ? rcSubscribers.value : null,
    },
    adSpending: adSummary,
  });
});

// Gelir zaman serisi
router.get('/metrics/revenue', requireAdmin, async (req, res) => {
  const days = Number(req.query.days) || 30;
  const data = await getRevenueSeries(RC_PROJECT_ID, days);
  res.json({ data });
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
        email: d.email || '',
        displayName: d.displayName || '',
        isPremium: d.isPremium || false,
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
        email: d.email || '',
        displayName: d.displayName || '',
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
