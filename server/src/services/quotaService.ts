import { getDb, persist } from '../db/store.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10); // yyyy-MM-dd
}

/** 统计当日高德 API 调用次数（仅真实调用高德的，source=amap） */
export function getTodayAmapCount(): number {
  return getDb().logs.filter(
    (l) => l.source === 'amap' && l.called_at.slice(0, 10) === todayPrefix()
  ).length;
}

/** 是否已超配额 */
export function isQuotaExceeded(): boolean {
  return getTodayAmapCount() >= config.dailyQuota;
}

/** 记录一次 API 调用 */
export function logApiCall(
  origin: string,
  destination: string,
  strategy: number,
  status: string,
  source: 'cache' | 'amap'
): void {
  const db = getDb();
  db.logs.push({
    id: ++db._logSeq,
    called_at: new Date().toISOString(),
    origin,
    destination,
    strategy,
    status,
    source,
  });
  persist();
  if (source === 'amap') {
    logger.info('quota', `amap call #${getTodayAmapCount()}/${config.dailyQuota}`);
  }
}
