import express from 'express';
import cors from 'cors';
import { env } from './env.js';
import { connectDb } from './db.js';
import { publicRouter } from './routes/public.js';
import { adminRouter } from './routes/admin.js';

await connectDb();

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()),
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.use('/api', publicRouter);
app.use('/api', adminRouter);

app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT}`);
});
