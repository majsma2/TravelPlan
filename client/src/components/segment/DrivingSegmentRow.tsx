import { useState } from 'react';
import { useTripStore, selectSegmentResult } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import { makeCacheKey } from '../../utils/geo';
import { driveSummary } from '../../utils/format';
import type { NodeData } from '../../types/domain';

interface Props {
  prev: NodeData;
  next: NodeData;
}

export default function DrivingSegmentRow({ prev, next }: Props) {
  const result = useTripStore((s) => selectSegmentResult(s, prev, next));
  const setManualSegment = useTripStore((s) => s.setManualSegment);
  const clearManualSegment = useTripStore((s) => s.clearManualSegment);
  const routePreference = useTripStore((s) => s.trip?.route_preference ?? 32);
  const pushToast = useUIStore((s) => s.pushToast);
  const [expanded, setExpanded] = useState(false);
  const [distKm, setDistKm] = useState('');
  const [durMin, setDurMin] = useState('');

  // 与 store 对齐的缓存键
  const key =
    prev.lng && prev.lat && next.lng && next.lat
      ? makeCacheKey(prev.lng, prev.lat, next.lng, next.lat, routePreference)
      : null;

  // 用哨兵键避免条件调用 hook
  const sentinel = key ?? '__none__';
  const isManual = !!useTripStore((s) => s.manualSegments[sentinel]);

  return (
    <div className="w-full shrink-0">
      <button
        className="w-full text-left text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg py-1.5 px-2 flex items-center gap-1"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>🚗</span>
        {!prev.lng || !prev.lat || !next.lng || !next.lat ? (
          <span className="flex-1 text-gray-400">请完善点位坐标</span>
        ) : result ? (
          <span className="flex-1">
            {result.status === 'rest'
              ? '原地休整'
              : driveSummary(result.distance, result.duration)}
            {result.status === 'no_route' && (
              <span className="text-amber-600 ml-1">（无路网，参考值）</span>
            )}
            {result.status === 'error' && (
              <span className="text-rose-600 ml-1">（获取失败）</span>
            )}
            {isManual && <span className="text-blue-600 ml-1">（手动）</span>}
          </span>
        ) : (
          <span className="flex-1 text-gray-400">算路中…</span>
        )}
      </button>
      {expanded && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-1 flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-500">
            里程(公里)
            <input
              className="block w-24 border rounded px-2 py-1 text-sm"
              type="number"
              value={distKm}
              onChange={(e) => setDistKm(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-500">
            耗时(分钟)
            <input
              className="block w-24 border rounded px-2 py-1 text-sm"
              type="number"
              value={durMin}
              onChange={(e) => setDurMin(e.target.value)}
            />
          </label>
          <button
            className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded"
            disabled={!key}
            onClick={() => {
              const d = parseFloat(distKm);
              const du = parseInt(durMin);
              if (!key || !Number.isFinite(d) || !Number.isFinite(du)) return;
              setManualSegment(key, { distance: d * 1000, duration: du * 60 });
              pushToast('success', '已手动覆盖本段里程耗时');
            }}
          >
            保存手动值
          </button>
          <button
            className="text-gray-500 text-sm px-2 py-1.5"
            disabled={!key || !isManual}
            onClick={() => key && clearManualSegment(key)}
          >
            清除手动值
          </button>
        </div>
      )}
    </div>
  );
}
