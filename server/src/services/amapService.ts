import crypto from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * 计算高德 Web 服务数字签名。
 * 算法（官方文档 https://lbs.amap.com/faq/quota-key/key/41181/）：
 *   sig = MD5( sortedParamsString + privateKey )
 * 其中 sortedParamsString 是所有请求参数（含 key，不含 sig）
 * 按参数名升序拼接成的 k=v&k=v&... 字符串（UTF-8 编码）。
 */
function calcAmapSig(
  params: Record<string, string>,
  secret: string
): string {
  const sorted = Object.keys(params).sort();
  const body = sorted.map((k) => `${k}=${params[k]}`).join('&');
  return crypto.createHash('md5').update(body + secret, 'utf8').digest('hex');
}

interface AmapDrivingResponse {
  status: string; // "1" 成功 "0" 失败
  info: string;
  infocode: string;
  count?: string;
  route?: {
    origin?: string;
    destination?: string;
    paths?: Array<{
      distance: string; // 米
      duration?: string; // 秒（部分版本在 path 层）
      steps?: Array<{
        polyline?: string;
        cost?: { duration?: string }; // 秒，每段
      }>;
    }>;
  };
}

export interface AmapDrivingData {
  distance: number; // 米
  duration: number; // 秒
  polyline: string; // 拼接后的完整 polyline
  status: 'ok' | 'no_route' | 'error';
  message?: string;
}

/**
 * 调用高德 v5 驾车路线规划 API
 * 文档：https://restapi.amap.com/v5/direction/driving
 */
export async function fetchDriving(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number,
  strategy: number
): Promise<AmapDrivingData> {
  const origin = `${originLng},${originLat}`;
  const destination = `${destLng},${destLat}`;
  const params: Record<string, string> = {
    key: config.amapWebKey,
    origin,
    destination,
    strategy: String(strategy),
    show_fields: 'cost',
  };
  // 若 Key 开启了数字签名验证，需计算 sig 参数
  if (config.amapWebSigSecret) {
    params.sig = calcAmapSig(params, config.amapWebSigSecret);
  }
  const search = new URLSearchParams(params).toString();
  const url = `${config.amapDrivingUrl}?${search}`;

  // 8s 超时
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(url, { signal: controller.signal });
    const data = (await resp.json()) as AmapDrivingResponse;

    if (data.status !== '1') {
      logger.warn('amap', `status!=1 infocode=${data.infocode} ${data.info}`);
      // infocode 10004 = 无路网数据
      if (data.infocode === '10004' || data.info?.includes('无路')) {
        return { distance: 0, duration: 0, polyline: '', status: 'no_route', message: data.info };
      }
      return { distance: 0, duration: 0, polyline: '', status: 'error', message: data.info };
    }

    const paths = data.route?.paths;
    if (!paths || paths.length === 0) {
      return { distance: 0, duration: 0, polyline: '', status: 'no_route', message: 'no paths' };
    }

    const path = paths[0];
    const distance = Number(path.distance) || 0;

    // duration：优先 path 层，否则汇总 steps 的 cost.duration
    let duration = path.duration ? Number(path.duration) : 0;
    const polyParts: string[] = [];
    if (path.steps && path.steps.length > 0) {
      if (!duration) {
        duration = path.steps.reduce(
          (sum, s) => sum + (s.cost?.duration ? Number(s.cost.duration) : 0),
          0
        );
      }
      for (const s of path.steps) {
        if (s.polyline) polyParts.push(s.polyline);
      }
    }

    if (distance === 0 && duration === 0) {
      return { distance: 0, duration: 0, polyline: '', status: 'no_route', message: 'empty result' };
    }

    return {
      distance,
      duration,
      polyline: polyParts.join(';'),
      status: 'ok',
    };
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') {
      logger.error('amap', `timeout ${origin}->${destination}`);
      return { distance: 0, duration: 0, polyline: '', status: 'error', message: 'request timeout' };
    }
    logger.error('amap', `fetch failed: ${err.message}`);
    return { distance: 0, duration: 0, polyline: '', status: 'error', message: err.message };
  } finally {
    clearTimeout(timer);
  }
}
