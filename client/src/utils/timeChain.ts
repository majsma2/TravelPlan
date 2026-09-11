import type { NodeData } from '../types/domain';

/**
 * 时序自动联动算法（单日内，可跨日承接前一天酒店）
 * - 有 prevHotel：首节点 arrive = 出发时间(departure_time 或默认 08:00) + 自驾耗时(酒店→首节点)
 * - 无 prevHotel：首节点 arrive_time 为「出发时间」；leave = arrive + play_duration
 * - 后续节点 arrive = 上一节点 leave + 本段自驾耗时；leave = arrive + play_duration
 * - autoLink 关闭：保持用户手填值不变
 * @param nodes 当日有序节点
 * @param getSegmentDuration 返回 a→b 的自驾耗时（秒）
 * @param autoLink 是否自动顺延
 * @param prevHotel 前一天酒店节点（虚拟起点），可为 null
 * @param departureTime 当日早晨出发时间（HH:mm），仅当有 prevHotel 时生效；为空则用 08:00
 * @param startIndex 从第几个节点开始重算（默认 0 = 全量重算）；>0 时复用 nodes[0..startIndex-1] 的引用
 * @param baseLeaveMin 当 startIndex>0 时，nodes[startIndex-1] 的离开时间（分钟），作为重算起点
 */
export function computeDaySchedule(
  nodes: NodeData[],
  getSegmentDuration: (a: NodeData, b: NodeData) => number,
  autoLink: boolean,
  prevHotel?: NodeData | null,
  departureTime?: string | null,
  startIndex: number = 0,
  baseLeaveMin?: number
): NodeData[] {
  if (!autoLink || nodes.length === 0) return nodes;

  // startIndex 之前的节点保持原引用不变（不复制对象，避免触发重渲染）
  const result: NodeData[] = [];
  for (let i = 0; i < startIndex && i < nodes.length; i++) {
    result.push(nodes[i]);
  }

  let t: number;
  if (startIndex <= 0) {
    if (prevHotel) {
      t = parseTimeToMin(departureTime ?? null, 8 * 60);
      const driveSec = getSegmentDuration(prevHotel, nodes[0]);
      t += Math.round(driveSec / 60);
    } else {
      t = parseTimeToMin(nodes[0].arrive_time, 8 * 60);
    }
    result.push({ ...nodes[0], arrive_time: minToTime(t) });
    t += nodes[0].play_duration;
    result[0].leave_time = minToTime(t);
    result[0].manual_time = 0;
  } else {
    // 从 startIndex 开始重算，基准为上一节点的 leave 时间
    t = baseLeaveMin ?? parseTimeToMin(nodes[startIndex - 1].leave_time, 8 * 60);
  }

  for (let i = Math.max(startIndex, 1); i < nodes.length; i++) {
    const prev = i === startIndex ? nodes[startIndex - 1] : result[i - 1];
    const driveSec = getSegmentDuration(prev, nodes[i]);
    t += Math.round(driveSec / 60);
    const arrive = minToTime(t);
    t += nodes[i].play_duration;
    const leave = minToTime(t);
    result.push({ ...nodes[i], arrive_time: arrive, leave_time: leave, manual_time: 0 });
  }
  return result;
}

export function parseTimeToMin(hhmm: string | null, fallback: number): number {
  if (!hhmm) return fallback;
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  return h * 60 + m;
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
