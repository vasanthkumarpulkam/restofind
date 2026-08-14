# RestoFind

**Find restaurants near you — with a location analytics dashboard on the admin side.**

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?logo=mongodb&logoColor=white)](https://mongodb.com)
[![Leaflet](https://img.shields.io/badge/Leaflet-199900?logo=leaflet&logoColor=white)](https://leafletjs.com)

---

## Overview

RestoFind is a two-sided demo application.

**Users** grant precise GPS access and see nearby restaurants ranked by real distance, with their location reverse-geocoded to a place name.

**Admins** log in to a dashboard showing incoming location pings on a Leaflet map, click analytics, CSV export, and a retention purge tool.

It's built as an npm workspaces monorepo with a TypeScript API and a TypeScript React client.

## Screenshots

<!-- Add screenshots here:
![User view](docs/screenshots/home.png)
![Admin map](docs/screenshots/admin-map.png)
-->

## Features

**User experience**

- Precise geolocation request with accuracy reporting
- Reverse geocoding to a human-readable place name
- Nearby restaurants sorted by haversine distance
- Restaurant click tracking
- Works with OpenStreetMap Overpass by default; upgrades to Google Places when an API key is configured

**Admin experience**

- JWT-authenticated login
- Live location log feed via server-sent events
- Leaflet map of all pings
- Click analytics
- CSV export of the log
- Retention purge — delete logs older than N days

## Tech stack

| Layer | Technology |
|---|---|
| Web | React 18, TypeScript, Vite, Tailwind CSS, React Router, Leaflet |
| API | Node.js, Express, TypeScript, Zod, Mongoose, jsonwebtoken |
| Database | MongoDB |
| Geo providers | OpenStreetMap Nominatim + Overpass (default), Google Places (optional) |

## Architecture

```
apps/web  (Vite + React)                apps/api  (Express + TypeScript)
├── pages/HomePage                      ├── routes/public.ts
├── pages/AdminLoginPage                │     POST /api/location
├── pages/AdminDashboardPage            │     GET  /api/restaurants
├── hooks/useGeolocation                │     POST /api/restaurant-click
└── lib/api, adminAuth, device,         ├── routes/admin.ts
        format, leafletFix              │     POST /api/auth/login
                                        │     GET  /api/admin/logs
                                        │     GET  /api/admin/logs.csv
                                        │     POST /api/admin/purge
                                        ├── middleware/auth.ts   (JWT)
                                        ├── models/LocationPing, RestaurantClick
                                        ├── services/geocode, restaurants
                                        └── utils/distance        (haversine)
                                                    │
                                                    ▼
                                                 MongoDB
```

Every endpoint validates its input with a Zod schema before touching the database.

## Getting started

### Prerequisites

- Node.js 18+
- MongoDB running locally or an Atlas connection string

### Install

```bash
git clone https://github.com/vasanthkumarpulkam/restofind.git
cd restofind
npm install
```

### Configure

```bash
cp apps/api/.env.example apps/api/.env
```

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `PORT` | | API port (default 8080) |
| `CORS_ORIGIN` | ✅ | Comma-separated allowed origins |
| `JWT_SECRET` | ✅ | Signing secret for admin tokens |
| `ADMIN_USER` | ✅ | Admin username |
| `ADMIN_PASS` | ✅ | Admin password |
| `GOOGLE_MAPS_API_KEY` | | Enables Google Places instead of OSM |

### Run

```bash
npm run dev:api          # API  → http://localhost:8080/api/health
npm run dev:web          # Web  → http://localhost:5173
npm run dev              # both
```

### Build

```bash
npm run build
npm run lint
```

## Privacy

This application intentionally collects precise location data. If you deploy it anywhere real, be explicit about that.

**What is stored:** latitude, longitude, GPS accuracy, timestamp, a generated device identifier, the user agent string, and the reverse-geocoded place name.

**Obligations:**

- Ask for informed consent before requesting geolocation permission
- Publish a privacy notice explaining what is collected and why
- Set and enforce a retention period — `POST /api/admin/purge` exists for this; schedule it
- Serve over HTTPS only (browsers require it for precise geolocation regardless)
- Restrict `CORS_ORIGIN` to your own domains

## Project structure

```
restofind/
├── apps/
│   ├── api/        Express + TypeScript API (Zod, Mongoose, JWT)
│   └── web/        Vite + React client (Leaflet, Tailwind)
└── package.json    npm workspaces root
```

> **Note:** the repository also contains legacy `client/` and `server/` directories from an earlier JavaScript implementation. They are not wired into the workspace scripts and are scheduled for removal — build from `apps/` only.

## API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check and active geo providers |
| `POST` | `/api/location` | — | Record a location ping |
| `GET` | `/api/restaurants` | — | Nearby restaurants by lat/lng |
| `POST` | `/api/restaurant-click` | — | Record a restaurant click |
| `POST` | `/api/auth/login` | — | Obtain an admin JWT (12h expiry) |
| `GET` | `/api/admin/me` | JWT | Current admin identity |
| `GET` | `/api/admin/logs` | JWT | Location logs (max 1000) |
| `GET` | `/api/admin/logs.csv` | JWT | CSV export (max 5000) |
| `POST` | `/api/admin/purge` | JWT | Delete logs older than N days |

## Roadmap

- [ ] Delete the legacy `client/` and `server/` directories
- [ ] Scheduled automatic retention purge
- [ ] Rate limiting on the public location endpoint
- [ ] Consent banner before the geolocation prompt

## Author

**Vasanth Kumar Pulkam** — [GitHub](https://github.com/vasanthkumarpulkam)
