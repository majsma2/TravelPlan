// 导出行程摘要为图片：原生 Canvas 绘制表格，无需第三方依赖
import { useTripStore } from '../stores/tripStore';
import { selectDayTotals, getSnapshot } from '../stores/tripStore';
import type { NodeData, TripPayload } from '../types/domain';
import { humanDuration, metersToKm } from './format';

interface RowData {
  date: string;
  driveDistance: string; // "12.3 公里"
  driveDuration: string; // "2 小时 5 分钟"
  hotelName: string;
  hotelArrive: string;
  hotelNote: string;
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** yyyy-MM-dd → "9月14日 周一" */
function formatDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return dateStr;
  return `${Number(parts[1])}月${Number(parts[2])}日 ${WEEKDAYS[d.getDay()]}`;
}

function collectRows(trip: TripPayload): RowData[] {
  // 用 getSnapshot 拿到时序联动后的节点（含 arrive_time）
  const snapshot = getSnapshot(useTripStore.getState());
  const state = useTripStore.getState();
  const rows: RowData[] = [];
  for (const day of snapshot.days) {
    const totals = selectDayTotals(state, day.id);
    const hotels = day.nodes.filter((n) => n.type === 'hotel');
    const hotel: NodeData | null = hotels.length > 0 ? hotels[hotels.length - 1] : null;
    rows.push({
      date: formatDate(day.date),
      driveDistance: `${metersToKm(totals.distance)} 公里`,
      driveDuration: humanDuration(totals.duration),
      hotelName: hotel?.name || '—',
      hotelArrive: hotel?.arrive_time || '—',
      hotelNote: hotel?.note || '',
    });
  }
  return rows;
}

/** 绘制表格并触发 PNG 下载 */
export function exportTripImage(): void {
  const state = useTripStore.getState();
  const trip = state.trip;
  if (!trip) return;

  const rows = collectRows(trip);
  if (rows.length === 0) return;

  // 列定义
  const columns = [
    { header: '日期', key: 'date', width: 140 },
    { header: '行车里程', key: 'driveDistance', width: 110 },
    { header: '行车时间', key: 'driveDuration', width: 130 },
    { header: '酒店名称', key: 'hotelName', width: 180 },
    { header: '抵达时间', key: 'hotelArrive', width: 90 },
    { header: '酒店备注', key: 'hotelNote', width: 280 },
  ] as const;

  // 画布尺寸
  const padding = 32;
  const titleHeight = 60;
  const headerHeight = 40;
  const rowHeight = 36;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);
  const tableHeight = headerHeight + rows.length * rowHeight;
  const canvasWidth = tableWidth + padding * 2;
  const canvasHeight = titleHeight + tableHeight + padding * 2;

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvasWidth * dpr;
  canvas.height = canvasHeight * dpr;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);

  // 字体
  const fontFamily =
    '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "WenQuanYi Micro Hei", sans-serif';

  // 背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 标题
  ctx.fillStyle = '#1f2937';
  ctx.font = `bold 22px ${fontFamily}`;
  ctx.textBaseline = 'top';
  ctx.fillText(trip.title || '行程摘要', padding, padding);
  // 副标题
  ctx.fillStyle = '#9ca3af';
  ctx.font = `13px ${fontFamily}`;
  const subtitle = `共 ${rows.length} 天 · 生成于 ${new Date().toLocaleString('zh-CN')}`;
  ctx.fillText(subtitle, padding, padding + 30);

  // 表格起点
  const tableX = padding;
  const tableY = padding + titleHeight;

  // 表头背景
  ctx.fillStyle = '#1e40af';
  ctx.fillRect(tableX, tableY, tableWidth, headerHeight);

  // 表头文字
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 14px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let x = tableX;
  for (const col of columns) {
    ctx.fillText(col.header, x + col.width / 2, tableY + headerHeight / 2);
    x += col.width;
  }

  // 行
  ctx.font = `13px ${fontFamily}`;
  ctx.textAlign = 'left';
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const y = tableY + headerHeight + i * rowHeight;
    // 交替行背景
    if (i % 2 === 1) {
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(tableX, y, tableWidth, rowHeight);
    }
    // 文字
    ctx.fillStyle = '#1f2937';
    let cx = tableX;
    for (const col of columns) {
      const text = String(row[col.key as keyof RowData] || '');
      // 备注列文本可能较长，按列宽截断
      const maxWidth = col.width - 16;
      let display = text;
      if (ctx.measureText(display).width > maxWidth) {
        // 简单截断加省略号
        while (display.length > 0 && ctx.measureText(display + '…').width > maxWidth) {
          display = display.slice(0, -1);
        }
        display += '…';
      }
      ctx.fillText(display, cx + 8, y + rowHeight / 2);
      cx += col.width;
    }
  }

  // 边框
  ctx.strokeStyle = '#d1d5db';
  ctx.lineWidth = 1;
  ctx.strokeRect(tableX, tableY, tableWidth, tableHeight);
  // 垂直分隔线
  let vx = tableX;
  for (const col of columns) {
    vx += col.width;
    ctx.beginPath();
    ctx.moveTo(vx, tableY);
    ctx.lineTo(vx, tableY + tableHeight);
    ctx.stroke();
  }
  // 水平分隔线（表头下）
  ctx.beginPath();
  ctx.moveTo(tableX, tableY + headerHeight);
  ctx.lineTo(tableX + tableWidth, tableY + headerHeight);
  ctx.stroke();
  // 行间分隔线
  for (let i = 1; i < rows.length; i++) {
    const y = tableY + headerHeight + i * rowHeight;
    ctx.beginPath();
    ctx.moveTo(tableX, y);
    ctx.lineTo(tableX + tableWidth, y);
    ctx.stroke();
  }

  // 触发下载
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = (trip.title || '行程摘要').replace(/[\\/:*?"<>|]/g, '_');
    a.download = `${safeTitle}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
