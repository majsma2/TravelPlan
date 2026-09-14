import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/store.js';

/**
 * 令牌校验中间件：优先使用 URL 路径中的 :token（操作目标行程），
 * 其次 query t，最后 header x-trip-token（当前上下文行程）
 */
export function tokenAuth(req: Request, res: Response, next: NextFunction): void {
  const token =
    (req.params.token as string) ||
    (req.query.t as string) ||
    (req.headers['x-trip-token'] as string);
  if (!token) {
    res.status(401).json({ error: 'missing_token', message: '缺少访问令牌' });
    return;
  }
  const trip = getDb().trips.find((t) => t.token === token);
  if (!trip) {
    res.status(404).json({ error: 'trip_not_found', message: '行程不存在' });
    return;
  }
  req.tripId = trip.id;
  req.tripToken = trip.token;
  next();
}
