import { create } from 'zustand';
import { apiClient, setToken } from '../services/apiClient';
import { makeCacheKey } from '../utils/geo';
import { computeDaySchedule, parseTimeToMin } from '../utils/timeChain';
import { idbLoad, idbSave } from '../utils/idbCache';
import { useUIStore } from './uiStore';
import type {
  TripPayload,
  DayData,
  NodeData,
  NodeType,
  DrivingResponse,
  TripSummary,
} from '../types/domain';

// crypto.randomUUID 仅在安全上下文（HTTPS / localhost）可用，
// Docker 部署经 IP + HTTP 访问时不可用，用 polyfill 兜底
const genId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

type CacheShape = {
  driving: Record<string, DrivingResponse>;
  manual: Record<string, { distance: number; duration: number }>;
};

// 持久化层：IndexedDB 为主，localStorage 作为兜底（IDB 不可用时降级）
function localKey(token: string) {
  return `tp_cache_${token}`;
}
function loadLocalFallback(token: string): CacheShape {
  try {
    const raw = localStorage.getItem(localKey(token));
    if (!raw) return { driving: {}, manual: {} };
    return JSON.parse(raw);
  } catch {
    return { driving: {}, manual: {} };
  }
}
function saveLocalFallback(
  token: string,
  driving: Record<string, DrivingResponse>,
  manual: Record<string, { distance: number; duration: number }>
) {
  const payload = JSON.stringify({ driving, manual });
  try {
    localStorage.setItem(localKey(token), payload);
  } catch {
    // 配额溢出：清理其他 token 的缓存后重试一次
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith('tp_cache_') && k !== localKey(token)) {
        localStorage.removeItem(k);
      }
    }
    try {
      localStorage.setItem(localKey(token), payload);
    } catch {
      // 仍失败：放弃持久化（不影响本次会话内的使用）
    }
  }
}

// IDB 是否可用（HTTP + IP 部署下可能被某些浏览器限制）
let idbAvailable = typeof indexedDB !== 'undefined';
// 启动时探测一次，失败则降级到 localStorage
void openDBProbe().then((ok) => (idbAvailable = ok));
async function openDBProbe(): Promise<boolean> {
  try {
    // 触发实际打开，验证是否能写入空记录
    await idbSave('__probe__', {}, {});
    return true;
  } catch {
    return false;
  }
}

/** 读缓存：优先 IDB，失败/不可用回退 localStorage */
async function loadCache(token: string): Promise<CacheShape> {
  if (idbAvailable) {
    const res = await idbLoad(token);
    if (res.driving || res.manual) return res;
    // IDB 没数据时回落 localStorage 一次，兼容历史数据
    const fallback = loadLocalFallback(token);
    if (fallback.driving || fallback.manual) return fallback;
    return { driving: {}, manual: {} };
  }
  return loadLocalFallback(token);
}

/** 写缓存：IDB 可用走 IDB，否则走 localStorage 兜底 */
function saveCache(
  token: string,
  driving: Record<string, DrivingResponse>,
  manual: Record<string, { distance: number; duration: number }>
) {
  if (idbAvailable) {
    // fire-and-forget，不阻塞 UI
    void idbSave(token, driving, manual);
    return;
  }
  saveLocalFallback(token, driving, manual);
}

/** 给 yyyy-MM-dd 加 n 天，返回 yyyy-MM-dd（用本地时区，避免 UTC 偏移导致少一天） */
function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + n);
    const y = fallback.getFullYear();
    const m = String(fallback.getMonth() + 1).padStart(2, '0');
    const day = String(fallback.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface TripState {
  trip: TripPayload | null;
  token: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  dirty: boolean;
  driving: Record<string, DrivingResponse>;
  manualSegments: Record<string, { distance: number; duration: number }>;
  changedDayId: string | null;
  changedNodeId: string | null;
  changedFromDayId: string | null; // 跨日移动时的源日，用于收集源日新增段

  // 行程管理列表
  view: 'list' | 'edit';
  tripsList: TripSummary[];
  listLoading: boolean;

  // 载入
  init: () => Promise<void>;
  createTrip: (title?: string) => Promise<void>;
  loadTrip: (token: string) => Promise<void>;
  persistTrip: () => Promise<void>;
  markDirty: () => void;

  // 管理列表
  listTrips: () => Promise<void>;
  deleteTrip: (token: string) => Promise<void>;
  copyTrip: (token: string) => Promise<void>;
  selectTrip: (token: string) => Promise<void>;
  backToList: () => void;

  // 行程级
  setTitle: (title: string) => void;
  setRoutePreference: (pref: number) => void;
  toggleAutoLink: () => void;
  toggleLock: () => void;
  setStartDate: (date: string) => void;
  recalcAllTimes: () => void;

  // 日
  addDay: () => void;
  copyDay: (dayId: string) => void;
  clearDay: (dayId: string) => void;
  deleteDay: (dayId: string) => void;
  setDayDepartureTime: (dayId: string, time: string | null) => void;

  // 节点
  addNode: (dayId: string, partial?: Partial<NodeData>) => void;
  updateNode: (nodeId: string, partial: Partial<NodeData>) => void;
  deleteNode: (nodeId: string) => void;
  moveNode: (
    nodeId: string,
    fromDayId: string,
    fromIndex: number,
    toDayId: string,
    toIndex: number
  ) => void;

  // 重算标记
  clearChangedDay: () => void;

  // 自驾分段
  setDriving: (key: string, res: DrivingResponse) => void;
  setManualSegment: (key: string, val: { distance: number; duration: number }) => void;
  clearManualSegment: (key: string) => void;
}

export const useTripStore = create<TripState>((set, get) => ({
  trip: null,
  token: null,
  status: 'idle',
  saveState: 'idle',
  dirty: false,
  driving: {},
  manualSegments: {},
  changedDayId: null,
  changedNodeId: null,
  changedFromDayId: null,
  view: 'list',
  tripsList: [],
  listLoading: false,

  init: async () => {
    const fromUrl = new URLSearchParams(location.search).get('t');
    // 仅当 URL 带 ?t= 时直接进入编辑（分享链接场景）；否则进入行程列表
    if (fromUrl) {
      await get().loadTrip(fromUrl);
      return;
    }
    set({ view: 'list', trip: null, token: null, status: 'idle' });
    await get().listTrips();
  },

  createTrip: async (title) => {
    const { data } = await apiClient.post('/trip', { title: title || '我的自驾行程' });
    setToken(data.token);
    await get().loadTrip(data.token);
  },

  listTrips: async () => {
    set({ listLoading: true });
    try {
      const { data } = await apiClient.get<TripSummary[]>('/trip');
      set({ tripsList: data, listLoading: false });
    } catch {
      useUIStore.getState().pushToast('error', '行程列表加载失败');
      set({ listLoading: false });
    }
  },

  deleteTrip: async (token) => {
    try {
      await apiClient.delete(`/trip/${token}`);
      useUIStore.getState().pushToast('success', '行程已删除');
      await get().listTrips();
    } catch {
      useUIStore.getState().pushToast('error', '删除失败');
    }
  },

  copyTrip: async (token) => {
    try {
      const { data } = await apiClient.post(`/trip/${token}/copy`);
      useUIStore.getState().pushToast('success', '行程已复制');
      await get().listTrips();
      // 复制完成后自动打开新行程
      setToken(data.token);
      await get().loadTrip(data.token);
    } catch {
      useUIStore.getState().pushToast('error', '复制失败');
    }
  },

  selectTrip: async (token) => {
    setToken(token);
    await get().loadTrip(token);
  },

  backToList: () => {
    set({
      view: 'list',
      trip: null,
      token: null,
      status: 'idle',
      dirty: false,
      driving: {},
      manualSegments: {},
    });
    void get().listTrips();
  },

  loadTrip: async (token) => {
    set({ status: 'loading', view: 'edit' });
    try {
      const { data } = await apiClient.get<TripPayload>(`/trip/${token}`);
      const cached = await loadCache(token);
      set({
        trip: data,
        token,
        status: 'ready',
        dirty: false,
        driving: cached.driving,
        manualSegments: cached.manual,
        view: 'edit',
      });
    } catch (e) {
      set({ status: 'error', view: 'list' });
      useUIStore.getState().pushToast('error', '行程加载失败');
    }
  },

  persistTrip: async () => {
    const { trip, token, dirty } = get();
    if (!trip || !token || !dirty) return;
    set({ saveState: 'saving' });
    try {
      await apiClient.put(`/trip/${token}`, getSnapshot(get()));
      set({ saveState: 'saved', dirty: false });
    } catch (e) {
      set({ saveState: 'error' });
      useUIStore.getState().pushToast('error', '保存失败，请检查网络');
    }
  },

  markDirty: () => set({ dirty: true, saveState: 'idle' }),

  setTitle: (title) => {
    const t = get().trip;
    if (!t) return;
    set({ trip: { ...t, title }, dirty: true, saveState: 'idle' });
  },

  setRoutePreference: (pref) => {
    const t = get().trip;
    if (!t) return;
    // 偏好变化会让所有分段 key 改变，清空 driving 触发重算
    set({
      trip: { ...t, route_preference: pref },
      driving: {},
      manualSegments: {},
      dirty: true,
      saveState: 'idle',
    });
  },

  toggleAutoLink: () => {
    const t = get().trip;
    if (!t) return;
    set({
      trip: { ...t, auto_link: t.auto_link ? 0 : 1 },
      dirty: true,
      saveState: 'idle',
    });
  },

  toggleLock: () => {
    const t = get().trip;
    if (!t) return;
    set({
      trip: { ...t, locked: t.locked ? 0 : 1 },
      dirty: true,
      saveState: 'idle',
    });
  },

  setStartDate: (date) => {
    const t = get().trip;
    if (!t) return;
    // 按天重算日期：day[i].date = start_date + i 天
    const days = t.days.map((d, i) => ({ ...d, date: addDays(date, i) }));
    set({
      trip: { ...t, start_date: date, days },
      dirty: true,
      saveState: 'idle',
    });
  },

  recalcAllTimes: () => {
    const t = get().trip;
    if (!t) return;
    // 清空高德驾驶缓存，保留用户手动覆盖（manualSegments）。
    // trip 引用变化触发 useDebouncedDriving 防抖重算；
    // changedDayId/changedNodeId 置空使 collectNeeded 走全量收集分支。
    set({
      trip: { ...t },
      driving: {},
      changedDayId: null,
      changedNodeId: null,
      changedFromDayId: null,
      dirty: true,
      saveState: 'idle',
    });
    useUIStore.getState().pushToast('info', '正在重新计算所有节点时间');
  },

  addDay: () => {
    const t = get().trip;
    if (!t) return;
    const days = [...t.days];
    const startDate = t.start_date || new Date().toISOString().slice(0, 10);
    days.push({
      id: genId(),
      date: addDays(startDate, days.length),
      order: days.length,
      departure_time: null,
      nodes: [],
    });
    set({ trip: { ...t, days }, dirty: true, saveState: 'idle' });
  },

  copyDay: (dayId) => {
    const t = get().trip;
    if (!t) return;
    const src = t.days.find((d) => d.id === dayId);
    if (!src) return;
    const days = [...t.days];
    const insertAt = src.order + 1;
    const startDate = t.start_date || new Date().toISOString().slice(0, 10);
    const newDay: DayData = {
      id: genId(),
      date: addDays(startDate, insertAt),
      order: insertAt,
      departure_time: src.departure_time ?? null,
      nodes: src.nodes.map((n, i) => ({
        ...n,
        id: genId(),
        day_id: '',
        order: i,
        manual_time: 0,
      })),
    };
    days.splice(insertAt, 0, newDay);
    days.forEach((d, i) => {
      d.order = i;
      d.date = addDays(startDate, i);
      newDay.nodes.forEach((n) => (n.day_id = newDay.id));
    });
    set({ trip: { ...t, days }, dirty: true, saveState: 'idle', changedDayId: newDay.id, changedNodeId: null, changedFromDayId: null });
  },

  setDayDepartureTime: (dayId, time) => {
    const t = get().trip;
    if (!t) return;
    const days = t.days.map((d) =>
      d.id === dayId ? { ...d, departure_time: time } : d
    );
    set({ trip: { ...t, days }, dirty: true, saveState: 'idle', changedDayId: dayId, changedNodeId: null, changedFromDayId: null });
  },

  clearDay: (dayId) => {
    const t = get().trip;
    if (!t) return;
    const days = t.days.map((d) =>
      d.id === dayId ? { ...d, nodes: [] } : d
    );
    set({ trip: { ...t, days }, dirty: true, saveState: 'idle', changedDayId: dayId, changedNodeId: null, changedFromDayId: null });
  },

  deleteDay: (dayId) => {
    const t = get().trip;
    if (!t) return;
    let days = t.days.filter((d) => d.id !== dayId);
    days = days.map((d, i) => ({ ...d, order: i }));
    set({ trip: { ...t, days }, dirty: true, saveState: 'idle', changedDayId: null, changedNodeId: null, changedFromDayId: null });
  },

  addNode: (dayId, partial) => {
    const t = get().trip;
    if (!t) return;
    // 酒店每天只允许手动添加一个
    if (partial?.type === 'hotel') {
      const day = t.days.find((d) => d.id === dayId);
      if (day && day.nodes.some((n) => n.type === 'hotel')) {
        useUIStore.getState().pushToast('error', '每天只能添加一个酒店');
        return;
      }
    }
    let newNodeId = '';
    const days = t.days.map((d) => {
      if (d.id !== dayId) return d;
      const node: NodeData = {
        id: genId(),
        day_id: dayId,
        order: d.nodes.length,
        type: (partial?.type as NodeType) || 'custom',
        name: partial?.name ?? '',
        address: partial?.address ?? '',
        lng: partial?.lng ?? null,
        lat: partial?.lat ?? null,
        arrive_time: partial?.arrive_time ?? null,
        leave_time: partial?.leave_time ?? null,
        play_duration: partial?.play_duration ?? 60,
        note: partial?.note ?? '',
        images: partial?.images ?? [],
        manual_time: partial?.manual_time ?? 0,
      };
      newNodeId = node.id;
      return { ...d, nodes: [...d.nodes, node] };
    });
    set({ trip: { ...t, days }, dirty: true, saveState: 'idle', changedDayId: dayId, changedNodeId: newNodeId, changedFromDayId: null });
  },

  updateNode: (nodeId, partial) => {
    const t = get().trip;
    if (!t) return;
    // 酒店每天只允许一个：改类型为 hotel 时校验同天是否已有其他酒店
    if (partial.type === 'hotel') {
      for (const d of t.days) {
        const idx = d.nodes.findIndex((n) => n.id === nodeId);
        if (idx >= 0) {
          const other = d.nodes.find((n) => n.id !== nodeId && n.type === 'hotel');
          if (other) {
            useUIStore.getState().pushToast('error', '每天只能有一个酒店');
            const { type: _omit, ...rest } = partial;
            if (Object.keys(rest).length === 0) return;
            partial = rest;
          }
          break;
        }
      }
    }
    let changedDayId: string | null = null;
    const days = t.days.map((d) => {
      if (!d.nodes.some((n) => n.id === nodeId)) return d;
      changedDayId = d.id;
      return {
        ...d,
        nodes: d.nodes.map((n) =>
          n.id === nodeId ? { ...n, ...partial } : n
        ),
      };
    });
    // 经纬度变化 → 该段 driving 失效
    if (partial.lng !== undefined || partial.lat !== undefined) {
      set({ trip: { ...t, days }, dirty: true, saveState: 'idle', changedDayId, changedNodeId: nodeId, changedFromDayId: null });
      return;
    }
    set({ trip: { ...t, days }, dirty: true, saveState: 'idle', changedDayId, changedNodeId: nodeId, changedFromDayId: null });
  },

  deleteNode: (nodeId) => {
    const t = get().trip;
    if (!t) return;
    let changedDayId: string | null = null;
    const days = t.days.map((d) => {
      if (!d.nodes.some((n) => n.id === nodeId)) return d;
      changedDayId = d.id;
      const nodes = d.nodes
        .filter((n) => n.id !== nodeId)
        .map((n, i) => ({ ...n, order: i }));
      return { ...d, nodes };
    });
    set({ trip: { ...t, days }, dirty: true, saveState: 'idle', changedDayId, changedNodeId: nodeId, changedFromDayId: null });
  },

  moveNode: (nodeId, fromDayId, fromIndex, toDayId, toIndex) => {
    const t = get().trip;
    if (!t) return;
    const days = t.days.map((d) => ({
      ...d,
      nodes: [...d.nodes],
    }));
    const fromDay = days.find((d) => d.id === fromDayId);
    if (!fromDay) return;
    const [moved] = fromDay.nodes.splice(fromIndex, 1);
    if (!moved) return;
    const toDay = days.find((d) => d.id === toDayId);
    if (!toDay) return;
    toDay.nodes.splice(toIndex, 0, { ...moved, day_id: toDayId });
    days.forEach((d) => {
      d.nodes.forEach((n, i) => (n.order = i));
    });
    set({
      trip: { ...t, days },
      dirty: true,
      saveState: 'idle',
      // 不清空 driving 缓存：缓存键基于坐标，多数段的 (origin,dest) 对未变仍有效
      changedDayId: toDayId,
      changedFromDayId: fromDayId !== toDayId ? fromDayId : null,
      // 同日移动：changedNodeId 置空，让 collectNeeded 收集当日全部段
      // （旧位置产生的新相邻段 i-1→i+1 不与移动节点新位置相邻，无法按节点过滤）
      // 跨日移动：保留 changedNodeId，目标日可做局部重算
      changedNodeId: fromDayId !== toDayId ? nodeId : null,
    });
  },

  clearChangedDay: () => set({ changedDayId: null, changedNodeId: null, changedFromDayId: null }),

  setDriving: (key, res) =>
    set((s) => {
      const driving = { ...s.driving, [key]: res };
      if (s.token) saveCache(s.token, driving, s.manualSegments);
      return { driving };
    }),

  setManualSegment: (key, val) =>
    set((s) => {
      const manualSegments = { ...s.manualSegments, [key]: val };
      if (s.token) saveCache(s.token, s.driving, manualSegments);
      return { manualSegments };
    }),

  clearManualSegment: (key) => {
    const s = get();
    const next = { ...s.manualSegments };
    delete next[key];
    if (s.token) saveCache(s.token, s.driving, next);
    set({ manualSegments: next });
  },
}));

// ===== 选择器（纯函数，从 store 派生） =====

/** 返回某天前一天的酒店节点（虚拟起点）。无则 null */
export function selectPrevDayHotel(
  state: TripState,
  dayId: string
): NodeData | null {
  const trip = state.trip;
  if (!trip) return null;
  const day = trip.days.find((d) => d.id === dayId);
  if (!day) return null;
  const prev = trip.days.find((d) => d.order === day.order - 1);
  if (!prev) return null;
  const hotels = prev.nodes.filter((n) => n.type === 'hotel');
  return hotels.length > 0 ? hotels[hotels.length - 1] : null;
}

/** 返回某段 a→b 的自驾耗时（秒）：手动覆盖优先，其次高德结果，最后 0 */
export function selectSegmentDuration(
  state: TripState,
  a: NodeData,
  b: NodeData
): number {
  if (!a.lng || !a.lat || !b.lng || !b.lat) return 0;
  const strategy = state.trip?.route_preference ?? 32;
  const key = makeCacheKey(a.lng, a.lat, b.lng, b.lat, strategy);
  const manual = state.manualSegments[key];
  if (manual) return manual.duration;
  return state.driving[key]?.duration ?? 0;
}

/** 返回某段 a→b 的完整结果（用于展示里程/耗时/轨迹） */
export function selectSegmentResult(
  state: TripState,
  a: NodeData,
  b: NodeData
): DrivingResponse | null {
  if (!a.lng || !a.lat || !b.lng || !b.lat) return null;
  const strategy = state.trip?.route_preference ?? 32;
  const key = makeCacheKey(a.lng, a.lat, b.lng, b.lat, strategy);
  const manual = state.manualSegments[key];
  if (manual) {
    return {
      distance: manual.distance,
      duration: manual.duration,
      polyline: state.driving[key]?.polyline ?? '',
      status: 'ok',
      source: 'amap',
    };
  }
  return state.driving[key] ?? null;
}

/**
 * 单日时序缓存：避免未变更的日期重复构造节点对象（减少重渲染）
 * key: dayId, value: { nodesRef, depSig, result }
 */
const dayScheduleCache = new Map<
  string,
  { nodesRef: NodeData[]; depSig: string; result: NodeData[] }
>();

/** 计算某日时序依赖的签名：出发时间 + 各段驾驶时长（含跨日酒店段） */
function dayDepSig(state: TripState, day: DayData, prevHotel: NodeData | null): string {
  const parts: string[] = [day.departure_time ?? ''];
  if (prevHotel && day.nodes[0]) {
    parts.push(String(selectSegmentDuration(state, prevHotel, day.nodes[0])));
  }
  for (let i = 1; i < day.nodes.length; i++) {
    parts.push(String(selectSegmentDuration(state, day.nodes[i - 1], day.nodes[i])));
  }
  return parts.join('|');
}

/** 返回应用时序联动后的行程快照（用于展示与持久化） */
export function getSnapshot(state: TripState): TripPayload {
  const t = state.trip;
  if (!t) return {} as TripPayload;
  const autoLink = t.auto_link === 1;
  const sortedDays = [...t.days].sort((a, b) => a.order - b.order);
  const newDays: DayData[] = [];
  let prevHotel: NodeData | null = null;
  for (const d of sortedDays) {
    const sig = dayDepSig(state, d, prevHotel);
    const cached = dayScheduleCache.get(d.id);
    const isChangedDay = state.changedDayId === d.id;
    const changedIdx = isChangedDay && state.changedNodeId
      ? d.nodes.findIndex((n) => n.id === state.changedNodeId)
      : -1;
    const nodesUnchanged = cached && cached.nodesRef === d.nodes;
    const depUnchanged = cached && cached.depSig === sig;
    let scheduled: NodeData[];
    if (nodesUnchanged && depUnchanged) {
      // 完全未变：直接复用缓存结果
      scheduled = cached.result;
    } else if (cached && changedIdx > 0 && changedIdx <= cached.result.length) {
      // 局部重算：节点数据变化 或 仅驾驶数据变化，且变更点不在首节点
      // 复用 cached.result[0..changedIdx-1] 的引用，从 changedIdx 起重算
      const baseLeaveMin = parseTimeToMin(cached.result[changedIdx - 1].leave_time, 8 * 60);
      const mixed: NodeData[] = [
        ...cached.result.slice(0, changedIdx),
        ...d.nodes.slice(changedIdx),
      ];
      scheduled = computeDaySchedule(
        mixed,
        (a, b) => selectSegmentDuration(state, a, b),
        autoLink,
        prevHotel,
        d.departure_time,
        changedIdx,
        baseLeaveMin
      );
      dayScheduleCache.set(d.id, { nodesRef: d.nodes, depSig: sig, result: scheduled });
    } else {
      // 全量重算（含驾驶数据变化的情况）
      scheduled = computeDaySchedule(
        d.nodes,
        (a, b) => selectSegmentDuration(state, a, b),
        autoLink,
        prevHotel,
        d.departure_time
      );
      dayScheduleCache.set(d.id, { nodesRef: d.nodes, depSig: sig, result: scheduled });
    }
    newDays.push({ ...d, nodes: scheduled });
    // 记录当天酒店，供下一天做跨日联动
    const hotels = scheduled.filter((n) => n.type === 'hotel');
    prevHotel = hotels.length > 0 ? hotels[hotels.length - 1] : null;
  }
  return { ...t, days: newDays };
}

/** 某日累计统计：总里程（米）、总驾驶时长（秒）。含虚拟起点段 */
export function selectDayTotals(state: TripState, dayId: string) {
  const day = state.trip?.days.find((d) => d.id === dayId);
  if (!day) return { distance: 0, duration: 0 };
  let distance = 0;
  let duration = 0;
  // 虚拟起点段：前一天酒店 → 当天首节点
  const prevHotel = selectPrevDayHotel(state, dayId);
  const first = day.nodes[0];
  if (prevHotel && first) {
    const res = selectSegmentResult(state, prevHotel, first);
    if (res) {
      distance += res.distance;
      duration += res.duration;
    }
  }
  for (let i = 1; i < day.nodes.length; i++) {
    const res = selectSegmentResult(state, day.nodes[i - 1], day.nodes[i]);
    if (res) {
      distance += res.distance;
      duration += res.duration;
    }
  }
  return { distance, duration };
}
