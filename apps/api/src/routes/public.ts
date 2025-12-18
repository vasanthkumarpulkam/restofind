import { Router } from 'express';
import { z } from 'zod';
import { LocationPing } from '../models/LocationPing.js';
import { RestaurantClick } from '../models/RestaurantClick.js';
import { reverseGeocode } from '../services/geocode.js';
import { getNearbyRestaurants } from '../services/restaurants.js';

export const publicRouter = Router();

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const LocationPingSchema = z.object({
  deviceId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
  timestamp: z.coerce.date(),
  userAgent: z.string().optional(),
  platform: z.string().optional()
});

publicRouter.post('/location/ping', async (req, res) => {
  const parsed = LocationPingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  const { deviceId, lat, lng, accuracy, timestamp, userAgent, platform } = parsed.data;
  const place = await reverseGeocode(lat, lng);

  const ping = await LocationPing.create({
    deviceId,
    lat,
    lng,
    accuracy,
    timestamp,
    place,
    userAgent,
    platform
  });

  return res.json({
    id: String(ping._id),
    lat,
    lng,
    accuracy,
    timestamp,
    place
  });
});

publicRouter.get('/restaurants/nearby', async (req, res) => {
  const schema = z.object({
    lat: z.coerce.number().min(-90).max(90),
    lng: z.coerce.number().min(-180).max(180),
    radiusMeters: z.coerce.number().int().positive().default(1500),
    placeType: z.enum(['any', 'restaurant', 'cafe', 'fast_food']).default('any'),
    cuisine: z.string().optional(),
    cuisines: z.string().optional(),
    maxDistanceMeters: z.coerce.number().int().positive().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    delivery: z.coerce.boolean().optional(),
    pickup: z.coerce.boolean().optional()
  });

  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_query', details: parsed.error.flatten() });
  }

  const cuisines = parsed.data.cuisines
    ? parsed.data.cuisines
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const restaurants = await getNearbyRestaurants({ ...parsed.data, cuisines });
  return res.json({ restaurants });
});

publicRouter.post('/restaurants/click', async (req, res) => {
  const schema = z.object({
    deviceId: z.string().min(1),
    restaurantId: z.string().min(1),
    name: z.string().min(1),
    cuisine: z.string().optional(),
    timestamp: z.coerce.date()
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_body', details: parsed.error.flatten() });
  }

  await RestaurantClick.create(parsed.data);
  return res.json({ ok: true });
});
