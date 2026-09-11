// 前端地理工具（与后端 key 生成保持一致，保证缓存键对齐）

const R = 6371000;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** 两点直线距离（米） */
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
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function truncCoord(v: number): number {
  return Math.round(v * 1e5) / 1e5;
}

/** 生成与后端一致的驾车缓存键 */
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

/** 高德 polyline 串（分号分隔 lng,lat）解析为坐标数组 */
export function parsePolyline(polyline: string): [number, number][] {
  const pts: [number, number][] = [];
  for (const pair of polyline.split(';')) {
    if (!pair) continue;
    const [lng, lat] = pair.split(',');
    if (lng && lat) pts.push([Number(lng), Number(lat)]);
  }
  return pts;
}
