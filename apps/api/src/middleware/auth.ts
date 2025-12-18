import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';

export type AdminClaims = {
  sub: string;
  role: 'admin';
};

declare global {
  // eslint-disable-next-line no-var
  var __restofind: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    admin?: AdminClaims;
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AdminClaims;
    if (!decoded || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden' });
    }
    req.admin = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}
