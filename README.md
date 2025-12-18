# RestoFind

Full-stack demo app:

- **User UI** (`/`): requests exact GPS permission, logs lat/lng/accuracy/timestamp, reverse geocodes to place name, and shows nearby restaurants sorted by distance (OSM Overpass by default; optionally Google Places if configured).
- **Admin UI** (`/admin`): JWT login, real-time-ish location logs, map view (Leaflet), analytics, CSV export, and log-retention purge.

## Run locally

1) **API**

- Copy `apps/api/.env.example` to `apps/api/.env`
- Ensure MongoDB is running and `MONGODB_URI` points to it

2) **Install + start**

```bash
npm install
npm run dev:api
npm run dev:web
```

- Web: `http://localhost:5173`
- API: `http://localhost:8080/api/health`