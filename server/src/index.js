require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const { stringify } = require('csv-stringify/sync');

const {
  insertGpsLog,
  listGpsLogs,
  listLatestPerUser,
  purgeGpsLogsOlderThanDays,
  insertRestaurantClick,
  getAnalytics,
} = require('./db');
const { reverseGeocodeNominatim } = require('./geocode');
const { fetchNearbyRestaurantsOSM } = require('./osm');
const {
  signAdminToken,
  verifyAdminCredentials,
  requireAdmin,
  requireAdminFromQueryToken,
} = require('./auth');

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || true,
  })
);
app.use(express.json({ limit: '256kb' }));

const sseClients = new Set();
function broadcastSse(eventName, payload) {
  const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      // ignore broken connections
    }
  }
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, now: Date.now() });
});

app.post('/api/location', async (req, res) => {
  const schema = z.object({
    userId: z.string().min(1).max(200),
    lat: z.number().finite(),
    lng: z.number().finite(),
    accuracyM: z.number().finite().optional().nullable(),
    tsMs: z.number().int().finite().optional().nullable(),
    userAgent: z.string().max(800).optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const { userId, lat, lng, accuracyM, tsMs, userAgent } = parsed.data;

  let place = null;
  try {
    place = await reverseGeocodeNominatim({ lat, lng });
  } catch (e) {
    place = { placeName: '', city: '', locality: '', road: '', country: '' };
  }

  const row = {
    userId,
    lat,
    lng,
    accuracyM: accuracyM ?? null,
    tsMs: tsMs ?? Date.now(),
    placeName: place.placeName || '',
    city: place.city || '',
    locality: place.locality || '',
    road: place.road || '',
    country: place.country || '',
    userAgent: userAgent ?? req.headers['user-agent'] ?? '',
  };

  const { id } = insertGpsLog(row);
  const full = { id, ...row };
  broadcastSse('gps_log', full);

  res.json({ ok: true, log: full, place });
});

app.get('/api/restaurants', async (req, res) => {
  const schema = z.object({
    lat: z.coerce.number().finite(),
    lng: z.coerce.number().finite(),
    radiusM: z.coerce.number().finite().optional(),
    limit: z.coerce.number().finite().optional(),
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' });

  try {
    const rows = await fetchNearbyRestaurantsOSM(parsed.data);
    res.json({ ok: true, restaurants: rows });
  } catch (e) {
    res.status(502).json({ error: 'Failed to fetch restaurants' });
  }
});

app.post('/api/restaurant-click', (req, res) => {
  const schema = z.object({
    userId: z.string().min(1).max(200),
    restaurantId: z.string().max(200).optional().nullable(),
    name: z.string().max(300).optional().nullable(),
    cuisine: z.string().max(200).optional().nullable(),
    tsMs: z.number().int().finite().optional().nullable(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  insertRestaurantClick({
    userId: parsed.data.userId,
    restaurantId: parsed.data.restaurantId ?? null,
    name: parsed.data.name ?? null,
    cuisine: parsed.data.cuisine ?? null,
    tsMs: parsed.data.tsMs ?? Date.now(),
  });
  res.json({ ok: true });
});

// Admin auth
app.post('/api/admin/login', async (req, res) => {
  const schema = z.object({
    username: z.string().min(1).max(200),
    password: z.string().min(1).max(200),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });

  const ok = await verifyAdminCredentials(parsed.data.username, parsed.data.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signAdminToken();
  res.json({ ok: true, token });
});

app.get('/api/admin/logs', requireAdmin, (req, res) => {
  const schema = z.object({
    limit: z.coerce.number().optional(),
    sinceMs: z.coerce.number().optional(),
    userId: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' });

  const logs = listGpsLogs(parsed.data);
  res.json({ ok: true, logs });
});

app.get('/api/admin/users/latest', requireAdmin, (req, res) => {
  res.json({ ok: true, users: listLatestPerUser() });
});

app.get('/api/admin/analytics', requireAdmin, (req, res) => {
  const schema = z.object({ rangeDays: z.coerce.number().optional() });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid query' });
  res.json({ ok: true, analytics: getAnalytics(parsed.data) });
});

app.get('/api/admin/export.csv', requireAdmin, (req, res) => {
  const logs = listGpsLogs({ limit: 1000 });
  const csv = stringify(logs, {
    header: true,
    columns: [
      'id',
      'userId',
      'lat',
      'lng',
      'accuracyM',
      'tsMs',
      'placeName',
      'city',
      'locality',
      'road',
      'country',
      'userAgent',
    ],
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="gps_logs.csv"');
  res.send(csv);
});

app.post('/api/admin/purge', requireAdmin, (req, res) => {
  const schema = z.object({ days: z.coerce.number().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  const result = purgeGpsLogsOlderThanDays(parsed.data.days ?? 30);
  res.json({ ok: true, result });
});

app.get('/api/admin/stream/logs', requireAdminFromQueryToken, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write('event: ready\ndata: {}\n\n');
  sseClients.add(res);

  req.on('close', () => {
    sseClients.delete(res);
  });
});

// Serve client build in production
const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Express v5 does not accept '*' or '/*' string wildcards; use a RegExp instead.
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});

