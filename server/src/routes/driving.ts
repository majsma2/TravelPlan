import { Router } from 'express';
import { tokenAuth } from '../middleware/tokenAuth.js';
import { makeCacheKey, distanceMeters } from '../utils/geo.js';
import { getCache, getStaleCache, setCache } from '../services/cacheService.js';
import { fetchDriving } from '../services/amapService.js';
import { isQuotaExceeded, logApiCall } from '../services/quotaService.js';
import { logger } from '../utils/logger.js';
import type { DrivingResponse } from '../types.js';

const router = Router();

function parseCoord(s: string): [number, number] | null {
  if (!s) return null;
  const [lng, lat] = s.split(',').map((v) => Number(v.trim()));
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

/** GET /api/driving?origin=lng,lat&destination=lng,lat&strategy=32 */
router.get('/', tokenAuth, async (req, res) => {
  const strategy = Number(req.query.strategy ?? 32);
  const origin = parseCoord(String(req.query.origin ?? ''));
  const destination = parseCoord(String(req.query.destination ?? ''));

  if (!origin || !destination) {
    res.status(400).json({ error: 'bad_coords', message: '经纬度缺失或格式错误' });
    return;
  }

  const [oLng, oLat] = origin;
  const [dLng, dLat] = destination;

  // 边界1：两点 <100m，原地休整
  if (distanceMeters(oLng, oLat, dLng, dLat) < 100) {
    const rest: DrivingResponse = {
      distance: 0,
      duration: 0,
      polyline: '',
      status: 'rest',
      source: 'cache',
      message: '原地休整，不计驾驶里程',
    };
    res.json(rest);
    return;
  }

  const cacheKey = makeCacheKey(oLng, oLat, dLng, dLat, strategy);

  // 1. 查缓存
  const cached = getCache(cacheKey);
  if (cached) {
    logApiCall(req.query.origin as string, req.query.destination as string, strategy, cached.status, 'cache');
    res.json(cached);
    return;
  }

  // 2. 配额检查
  if (isQuotaExceeded()) {
    // 配额超限：返回陈旧缓存（若有），否则提示
    const stale = getStaleCache(cacheKey);
    if (stale) {
      res.json({ ...stale, message: '今日高德 API 配额已用尽，展示缓存数据' });
      return;
    }
    res.status(429).json({ error: 'quota_exceeded', message: '今日高德 API 配额已用尽，请手动刷新或明日再试' });
    return;
  }

  // 3. 调高德
  const result = await fetchDriving(oLng, oLat, dLng, dLat, strategy);
  const originStr = `${oLng},${oLat}`;
  const destStr = `${dLng},${dLat}`;

  if (result.status === 'ok') {
    setCache(cacheKey, result, strategy);
    logApiCall(originStr, destStr, strategy, 'ok', 'amap');
    res.json({ ...result, source: 'amap' });
    return;
  }

  // 4. 高德失败/无路网：回退陈旧缓存
  const stale = getStaleCache(cacheKey);
  logApiCall(originStr, destStr, strategy, result.status, 'amap');
  if (stale) {
    res.json({
      ...stale,
      message: `网络异常/无路网，展示上一次缓存（${result.message ?? ''}）`,
    });
    return;
  }

  // 5. 无任何缓存，返回错误/无路网状态
  res.json({
    distance: 0,
    duration: 0,
    polyline: '',
    status: result.status,
    source: 'amap',
    message:
      result.status === 'no_route'
        ? '高德无法规划驾车路线，请更换点位或手动填写路程信息'
        : `获取自驾路线失败：${result.message ?? ''}`,
  });
});

export default router;
