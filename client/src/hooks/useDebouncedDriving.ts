import { useEffect, useRef } from 'react';
import { searchDriving } from '../services/amapJs';
import { useTripStore } from '../stores/tripStore';
import { useUIStore } from '../stores/uiStore';
import { makeCacheKey, distanceMeters } from '../utils/geo';
import type { TripPayload, DrivingResponse } from '../types/domain';

const fetching = new Set<string>();

/**
 * 收集需算路的相邻节点段（有坐标）
 * @param focusDayId 若指定，仅收集该日及其前后相邻日的段；null 则全量收集
 * @param focusNodeId 若指定，仅收集与该节点直接相邻的两段（i-1→i 和 i→i+1），
 *                    以及涉及该节点的跨日段（首节点的前日酒店段、酒店节点的次日首段）
 * @param focusFromDayId 跨日移动时的源日，也纳入收集范围（源日节点被移除后产生新相邻段）
 */
function collectNeeded(
  trip: TripPayload,
  strategy: number,
  focusDayId: string | null,
  focusNodeId: string | null,
  focusFromDayId: string | null = null
) {
  const list: {
    key: string;
    originLng: number;
    originLat: number;
    destLng: number;
    destLat: number;
  }[] = [];
  const sorted = [...trip.days].sort((a, b) => a.order - b.order);

  // 定位变更节点所在的 day 和 index
  let focusNodeDayIdx = -1;
  let focusNodeIdx = -1;
  let focusNodeIsHotel = false;
  if (focusNodeId) {
    for (let di = 0; di < sorted.length; di++) {
      const ni = sorted[di].nodes.findIndex((n) => n.id === focusNodeId);
      if (ni >= 0) {
        focusNodeDayIdx = di;
        focusNodeIdx = ni;
        focusNodeIsHotel = sorted[di].nodes[ni].type === 'hotel';
        break;
      }
    }
  }

  // 收集范围：目标日 ±1 以及源日 ±1（跨日移动时）
  let focusSet: Set<string> | null = null;
  for (const dayId of [focusDayId, focusFromDayId]) {
    if (!dayId) continue;
    const idx = sorted.findIndex((d) => d.id === dayId);
    if (idx < 0) continue;
    if (!focusSet) focusSet = new Set<string>();
    for (let k = idx - 1; k <= idx + 1; k++) {
      if (k >= 0 && k < sorted.length) focusSet.add(sorted[k].id);
    }
  }

  let prevHotel: TripPayload['days'][number]['nodes'][number] | null = null;
  for (let di = 0; di < sorted.length; di++) {
    const day = sorted[di];
    const inFocus = !focusSet || focusSet.has(day.id);
    if (inFocus) {
      const first = day.nodes[0];
      const isFocusDay = focusNodeDayIdx === di;
      // 变更节点已被删除（找不到）时，回退为收集 focus 日内全部段
      const nodeFilterActive = focusNodeId && focusNodeDayIdx >= 0;

      // 跨日段：前一天酒店 → 当天首节点
      // 若指定了变更节点且仍存在，仅当首节点是变更节点、或前一天酒店是变更节点时才收集
      const needCrossDay = !nodeFilterActive ||
        (isFocusDay && focusNodeIdx === 0) ||
        (di === focusNodeDayIdx + 1 && focusNodeIsHotel);
      if (needCrossDay && prevHotel && first && prevHotel.lng && prevHotel.lat && first.lng && first.lat) {
        list.push({
          key: makeCacheKey(prevHotel.lng, prevHotel.lat, first.lng, first.lat, strategy),
          originLng: prevHotel.lng,
          originLat: prevHotel.lat,
          destLng: first.lng,
          destLat: first.lat,
        });
      }

      // 日内段：node[i-1] → node[i]
      for (let i = 1; i < day.nodes.length; i++) {
        // 若指定了变更节点且仍存在，仅收集与变更节点相邻的段（i-1→i 或 i→i+1）
        if (nodeFilterActive && isFocusDay) {
          const involvesFocus = i === focusNodeIdx || i - 1 === focusNodeIdx;
          if (!involvesFocus) continue;
        }
        const a = day.nodes[i - 1];
        const b = day.nodes[i];
        if (a.lng && a.lat && b.lng && b.lat) {
          list.push({
            key: makeCacheKey(a.lng, a.lat, b.lng, b.lat, strategy),
            originLng: a.lng,
            originLat: a.lat,
            destLng: b.lng,
            destLat: b.lat,
          });
        }
      }
    }
    // 记录当天酒店供下一天使用
    const hotels = day.nodes.filter((n) => n.type === 'hotel');
    prevHotel = hotels.length > 0 ? hotels[hotels.length - 1] : null;
  }
  return list;
}

async function fetchNeeded(trip: TripPayload) {
  // 离线不调用 API
  if (!navigator.onLine) return;
  const strategy = trip.route_preference;
  const { driving, manualSegments, changedDayId, changedNodeId, changedFromDayId } = useTripStore.getState();
  const needed = collectNeeded(trip, strategy, changedDayId, changedNodeId, changedFromDayId);
  const toFetch = needed.filter(
    (n) => !driving[n.key] && !manualSegments[n.key] && !fetching.has(n.key)
  );

  for (const n of toFetch) {
    fetching.add(n.key);
    try {
      // 边界1：两点 <100m，原地休整
      if (distanceMeters(n.originLng, n.originLat, n.destLng, n.destLat) < 100) {
        const rest: DrivingResponse = {
          distance: 0,
          duration: 0,
          polyline: '',
          status: 'rest',
          source: 'amap',
          message: '原地休整，不计驾驶里程',
        };
        useTripStore.getState().setDriving(n.key, rest);
        continue;
      }
      // 通过 JS API 的 AMap.Driving 插件算路（前端直调，无需后端签名）
      const res = await searchDriving(
        n.originLng,
        n.originLat,
        n.destLng,
        n.destLat,
        strategy
      );
      useTripStore.getState().setDriving(n.key, {
        ...res,
        source: 'amap',
      });
    } catch (e: any) {
      useUIStore.getState().pushToast('error', '获取自驾路线失败');
    } finally {
      fetching.delete(n.key);
    }
    // 串行限频：每秒最多 1 次
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 所有分段处理完毕后再清除标记，保证 getSnapshot 在算路结果陆续写入时
  // 仍能依据 changedNodeId 做局部重算；若期间用户又编辑了其他节点则不清除
  const cur = useTripStore.getState();
  if (
    cur.changedDayId === changedDayId &&
    cur.changedNodeId === changedNodeId &&
    cur.changedFromDayId === changedFromDayId
  ) {
    cur.clearChangedDay();
  }
}

/** 行程结构/坐标变化后防抖 800ms，串行拉取缺失的自驾分段 */
export function useDebouncedDriving() {
  const trip = useTripStore((s) => s.trip);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!trip) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void fetchNeeded(trip);
    }, 800);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [trip]);
}
