import { getDb, persist } from '../db/store.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import type { DrivingResult } from '../types.js';

/** 缓存是否过期（按 DRIVING_TTL_DAYS） */
function isExpired(createdAt: string): boolean {
  return (
    Date.now() - new Date(createdAt).getTime() >
    config.drivingTtlDays * 24 * 60 * 60 * 1000
  );
}

/** 读缓存；未命中或已过期返回 null */
export function getCache(cacheKey: string): DrivingResult | null {
  const row = getDb().segments.find((s) => s.cache_key === cacheKey);
  if (!row) return null;
  if (isExpired(row.created_at)) {
    logger.info('cache', `expired: ${cacheKey}`);
    return null;
  }
  return {
    distance: row.distance,
    duration: row.duration,
    polyline: row.polyline,
    status: row.status as DrivingResult['status'],
    source: 'cache',
  };
}

/** 读陈旧缓存（忽略 TTL），用于 API 失败时回退 */
export function getStaleCache(cacheKey: string): DrivingResult | null {
  const row = getDb().segments.find((s) => s.cache_key === cacheKey);
  if (!row) return null;
  return {
    distance: row.distance,
    duration: row.duration,
    polyline: row.polyline,
    status: row.status as DrivingResult['status'],
    source: 'cache',
  };
}

/** 写缓存（upsert） */
export function setCache(
  cacheKey: string,
  result: Omit<DrivingResult, 'source'>,
  strategy: number
): void {
  const db = getDb();
  const idx = db.segments.findIndex((s) => s.cache_key === cacheKey);
  const row = {
    cache_key: cacheKey,
    distance: result.distance,
    duration: result.duration,
    polyline: result.polyline,
    strategy,
    status: result.status,
    created_at: new Date().toISOString(),
  };
  if (idx >= 0) db.segments[idx] = row;
  else db.segments.push(row);
  persist();
}
