import mongoose from 'mongoose';
import { env } from './env.js';

let connected = false;

export async function connectDb() {
  if (connected) return;
  await mongoose.connect(env.MONGODB_URI);
  connected = true;
}
