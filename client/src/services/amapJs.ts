import AMapLoader from '@amap/amap-jsapi-loader';
import { apiClient } from './apiClient';

// 高德 AMap 命名空间类型（JS API 无官方 d.ts，使用宽松类型）
type AMapNS = any;

let amapPromise: Promise<AMapNS> | null = null;

/** 单例加载高德 JS API 2.0（key 与安全密钥从后端 /api/config 获取） */
export function loadAmap(): Promise<AMapNS> {
  if (amapPromise) return amapPromise;
  amapPromise = (async () => {
    const { data } = await apiClient.get('/config');
    const { jsKey, jsSecurity } = data as { jsKey: string; jsSecurity: string };
    if (!jsKey) {
      throw new Error('未配置高德 JS API key，请在 server/.env 填写 AMAP_JS_KEY 与 AMAP_JS_SECURITY');
    }
    // 必须在 AMapLoader.load 之前设置安全密钥
    (window as any)._AMapSecurityConfig = { securityJsCode: jsSecurity };
    return AMapLoader.load({
      key: jsKey,
      version: '2.0',
      plugins: [
        'AMap.Scale',
        'AMap.AutoComplete',
        'AMap.PlaceSearch',
        'AMap.Geocoder',
        'AMap.Driving',
      ],
    }) as Promise<AMapNS>;
  })();
  return amapPromise;
}

/** 输入提示搜索（地址 → 候选 POI），供 NodeEditor 地址选择 */
export async function placeSearch(keyword: string, city = '全国'): Promise<
  Array<{ name: string; address: string; lng: number; lat: number; type?: string }>
> {
  const AMap = await loadAmap();
  return new Promise((resolve) => {
    const placeSearch = new AMap.PlaceSearch({
      city,
      pageSize: 10,
      pageIndex: 1,
    });
    placeSearch.search(keyword, (status: string, result: any) => {
      if (status !== 'complete' || !result?.poiList?.pois?.length) {
        resolve([]);
        return;
      }
      resolve(
        result.poiList.pois.map((p: any) => ({
          name: p.name,
          address: p.address || p.name,
          lng: p.location?.lng ?? null,
          lat: p.location?.lat ?? null,
          type: p.typecode,
        }))
      );
    });
  });
}

/**
 * 通过 JS API 的 AMap.Driving 插件规划驾车路线。
 * 避免后端 Web Service API 的数字签名问题。
 *
 * @param originLng  起点经度
 * @param originLat  起点纬度
 * @param destLng    终点经度
 * @param destLat    终点纬度
 * @param strategy   32=默认 / 34=优先高速 / 35=避开高速
 */
export async function searchDriving(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number,
  strategy: number
): Promise<{
  distance: number;
  duration: number;
  polyline: string;
  status: 'ok' | 'no_route' | 'error';
  message?: string;
}> {
  const AMap = await loadAmap();

  // 策略映射：JS API DrivingPolicy 值
  // LEAST_TIME = 0（最快，倾向高速）, LEAST_DISTANCE = 1, MIN_FEE = 2（避免收费=不走高速）
  let policy: number;
  if (strategy === 35) {
    policy = AMap.DrivingPolicy.MIN_FEE;
  } else {
    // 32 默认 / 34 优先高速 → 均用最快时间
    policy = AMap.DrivingPolicy.LEAST_TIME;
  }

  return new Promise((resolve) => {
    const driving = new AMap.Driving({
      policy,
      ferry: 1, // 包含轮渡
    });

    driving.search(
      new AMap.LngLat(originLng, originLat),
      new AMap.LngLat(destLng, destLat),
      (status: string, result: any) => {
        if (status !== 'complete' || !result?.routes?.length) {
          resolve({
            distance: 0,
            duration: 0,
            polyline: '',
            status: 'no_route',
            message: result?.info || '无驾车路线',
          });
          return;
        }
        const route = result.routes[0];
        const distance = route.distance ?? 0;
        const duration = route.time ?? 0;
        // 拼接所有 step 的 path 为 polyline 串（lng,lat;lng,lat;...）
        const polyParts: string[] = [];
        const steps = route.steps ?? [];
        for (const step of steps) {
          const path = step.path ?? [];
          for (const pt of path) {
            const lng = pt.lng ?? pt.getLng?.();
            const lat = pt.lat ?? pt.getLat?.();
            if (lng != null && lat != null) {
              polyParts.push(`${lng},${lat}`);
            }
          }
        }
        if (distance === 0 && duration === 0) {
          resolve({
            distance: 0,
            duration: 0,
            polyline: '',
            status: 'no_route',
            message: '空结果',
          });
          return;
        }
        resolve({
          distance,
          duration,
          polyline: polyParts.join(';'),
          status: 'ok',
        });
      }
    );
  });
}
