import { Router } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import { requireAdmin } from '../middleware/auth.js';
import { LocationPing } from '../models/LocationPing.js';
import { RestaurantClick } from '../models/RestaurantClick.js';

export const adminRouter = Router();

adminRouter.post('/auth/login', async (req, res) => {
  const schema = z.object({
    username: z.string().min(1),
    password: z.string().min(1)
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  const { username, password } = parsed.data;
  if (username !== env.ADMIN_USER || password !== env.ADMIN_PASS) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const token = jwt.sign({ sub: username, role: 'admin' }, env.JWT_SECRET, { expiresIn: '12h' });
  return res.json({ token });
});

adminRouter.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ admin: req.admin });
});

adminRouter.get('/admin/logs', requireAdmin, async (req, res) => {
  const schema = z.object({
    limit: z.coerce.number().int().positive().max(1000).default(200)
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
  }

  const logs = await LocationPing.find({})
    .sort({ timestamp: -1 })
    .limit(parsed.data.limit)
    .lean();

  res.json({ logs });
});

adminRouter.get('/admin/logs.csv', requireAdmin, async (_req, res) => {
  const logs = await LocationPing.find({}).sort({ timestamp: -1 }).limit(5000).lean();

  const header = [
    'deviceId',
    'lat',
    'lng',
    'accuracy',
    'timestamp',
    'place.displayName',
    'place.city',
    'place.road',
    'userAgent',
    'platform'
  ];

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [header.join(',')].concat(
    logs.map((l: any) =>
      [
        l.deviceId,
        l.lat,
        l.lng,
        l.accuracy,
        l.timestamp,
        l.place?.displayName,
        l.place?.city,
        l.place?.road,
        l.userAgent,
        l.platform
      ]
        .map(escape)
        .join(',')
    )
  );

  res.setHeader('content-type', 'text/csv');
  res.setHeader('content-disposition', 'attachment; filename="location-logs.csv"');
  res.send(lines.join('\n'));
});

adminRouter.delete('/admin/logs/purge', requireAdmin, async (req, res) => {
  const schema = z.object({ days: z.coerce.number().int().positive().max(3650).default(30) });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
  }

  const cutoff = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000);
  const result = await LocationPing.deleteMany({ createdAt: { $lt: cutoff } });
  res.json({ ok: true, deleted: result.deletedCount ?? 0, cutoff });
});

adminRouter.get('/admin/analytics', requireAdmin, async (req, res) => {
  const schema = z.object({ days: z.coerce.number().int().positive().max(3650).default(30) });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
  }

  const since = new Date(Date.now() - parsed.data.days * 24 * 60 * 60 * 1000);

  const [pingsCount, clicksCount, topCities, topCuisines, topRestaurants, dailyPings, weeklyPings] = await Promise.all([
    LocationPing.countDocuments({ createdAt: { $gte: since } }),
    RestaurantClick.countDocuments({ createdAt: { $gte: since } }),
    LocationPing.aggregate([
      { $match: { createdAt: { $gte: since }, 'place.city': { $exists: true, $ne: null } } },
      { $group: { _id: '$place.city', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    RestaurantClick.aggregate([
      { $match: { createdAt: { $gte: since }, cuisine: { $exists: true, $ne: null } } },
      { $group: { _id: '$cuisine', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    RestaurantClick.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { id: '$restaurantId', name: '$name' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]),
    LocationPing.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            y: { $year: '$createdAt' },
            m: { $month: '$createdAt' },
            d: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } }
    ]),
    LocationPing.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            y: { $isoWeekYear: '$createdAt' },
            w: { $isoWeek: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.y': 1, '_id.w': 1 } }
    ])
  ]);

  res.json({
    since,
    windowDays: parsed.data.days,
    totals: { pings: pingsCount, clicks: clicksCount },
    dailyPings,
    weeklyPings,
    topCities,
    topCuisines,
    topRestaurants
  });
});
