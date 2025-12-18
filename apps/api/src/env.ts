import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  NODE_ENV: z.string().default('development'),
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:27017/restofind'),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  ADMIN_USER: z.string().default('admin'),
  ADMIN_PASS: z.string().default('admin'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  GOOGLE_MAPS_API_KEY: z.string().optional()
});

export const env = EnvSchema.parse(process.env);
