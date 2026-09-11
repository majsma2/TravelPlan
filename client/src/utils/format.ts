// 格式化与时间工具

/** 米 → 公里（1 位小数） */
export function metersToKm(m: number): string {
  return (m / 1000).toFixed(1);
}

/** 秒 → 分钟（取整） */
export function secondsToMin(s: number): number {
  return Math.round(s / 60);
}

/** "HH:mm" → 当日分钟数 */
export function timeToMin(hhmm: string | null): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** 分钟数 → "HH:mm"（允许超过 23 点以反映当日溢出） */
export function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 驾车摘要文案：12.3公里·45分钟 或 12.3公里·2小时5分钟（>60分钟时） */
export function driveSummary(distance: number, duration: number): string {
  return `${metersToKm(distance)}公里·${humanDuration(duration)}`;
}

/** 当日累计驾驶时长（秒） */
export function sumDayDriveDuration(
  durations: number[]
): number {
  return durations.reduce((s, d) => s + d, 0);
}

/** 秒 → "X小时Y分钟" */
export function humanDuration(seconds: number): string {
  const min = Math.round(seconds / 60);
  const h = Math.floor(min / 60);
  const m = min - h * 60;
  if (h === 0) return `${m}分钟`;
  return `${h}小时${m}分钟`;
}
