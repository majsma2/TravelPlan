// 地理工具：haversine 距离、缓存键生成、坐标截断
const R = 6371000; // 地球半径（米）

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** 两点间直线距离（米），haversine 公式 */
export function distanceMeters(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** 经纬度截断到 5 位小数（约 1 米精度），用于缓存键去抖动 */
export function truncCoord(v: number): number {
  return Math.round(v * 1e5) / 1e5;
}

/**
 * 生成驾车缓存键
 * 格式：lng,lat|lng,lat|strategy（坐标截断 5 位小数）
 */
export function makeCacheKey(
  originLng: number,
  originLat: number,
  destLng: number,
  destLat: number,
  strategy: number
): string {
  return [
    `${truncCoord(originLng)},${truncCoord(originLat)}`,
    `${truncCoord(destLng)},${truncCoord(destLat)}`,
    strategy,
  ].join('|');
}

/** 高德 polyline 字符串（分号分隔的 lng,lat 对）解析为 [[lng,lat],...] 数组 */
export function parsePolyline(polyline: string): [number, number][] {
  const points: [number, number][] = [];
  for (const pair of polyline.split(';')) {
    if (!pair) continue;
    const [lng, lat] = pair.split(',');
    if (lng && lat) {
      points.push([Number(lng), Number(lat)]);
    }
  }
  return points;
}
