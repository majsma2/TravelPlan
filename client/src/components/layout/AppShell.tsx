import { useCallback, useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import { ROUTE_PREFERENCES } from '../../types/domain';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useDebouncedDriving } from '../../hooks/useDebouncedDriving';
import { useFatigueReminder } from '../../hooks/useFatigueReminder';
import { exportTripImage } from '../../utils/exportTripImage';
import TripBoard from './TripBoard';
import MapView from '../map/MapView';

export default function AppShell() {
  const trip = useTripStore((s) => s.trip);
  const setTitle = useTripStore((s) => s.setTitle);
  const setRoutePreference = useTripStore((s) => s.setRoutePreference);
  const toggleAutoLink = useTripStore((s) => s.toggleAutoLink);
  const toggleLock = useTripStore((s) => s.toggleLock);
  const recalcAllTimes = useTripStore((s) => s.recalcAllTimes);
  const setStartDate = useTripStore((s) => s.setStartDate);
  const saveState = useTripStore((s) => s.saveState);
  const backToList = useTripStore((s) => s.backToList);
  useAutoSave();
  useDebouncedDriving();
  useFatigueReminder();

  // 左右面板分割：leftPct 为左侧行程面板宽度百分比
  const [leftPct, setLeftPct] = useState(58);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setLeftPct(Math.min(85, Math.max(20, pct)));
  }, []);

  const onMouseUp = useCallback(() => {
    draggingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const locked = trip?.locked === 1;

  const saveLabel =
    saveState === 'saving'
      ? '保存中…'
      : saveState === 'saved'
      ? '已保存'
      : saveState === 'error'
      ? '保存失败'
      : ' ';

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b px-4 py-2 flex items-center gap-4 flex-wrap">
        <button
          className="text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded px-2 py-1"
          onClick={backToList}
          title="返回行程列表"
        >
          ← 行程列表
        </button>
        <input
          className="font-bold text-lg text-gray-800 bg-transparent focus:outline-none border-b border-transparent focus:border-blue-400"
          value={trip?.title ?? ''}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className={`text-sm flex items-center gap-1 ${locked ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500'}`}>
          开始日期
          <input
            type="date"
            className="border rounded px-2 py-1 text-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
            value={trip?.start_date ?? ''}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={locked}
          />
        </label>
        <label className="text-sm text-gray-500">路线偏好</label>
        <select
          value={trip?.route_preference ?? 32}
          onChange={(e) => setRoutePreference(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          {ROUTE_PREFERENCES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="text-sm text-gray-600 flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={trip?.auto_link === 1}
            onChange={toggleAutoLink}
          />
          时序自动顺延
        </label>
        <button
          className={`text-sm px-3 py-1 rounded-lg font-medium ${
            locked
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-50 hover:bg-blue-100 text-blue-600'
          }`}
          onClick={recalcAllTimes}
          disabled={locked}
          title="清空驾驶缓存并重新拉取所有节点路线"
        >
          ⟳ 重算行程时间
        </button>
        <button
          className={`text-sm px-3 py-1 rounded-lg font-medium ${
            locked
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
          }`}
          onClick={toggleLock}
        >
          {locked ? '🔒 解锁' : '🔒 锁定行程'}
        </button>
        <button
          className="text-sm px-3 py-1 rounded-lg font-medium bg-green-50 hover:bg-green-100 text-green-600"
          onClick={exportTripImage}
          title="导出每日行程摘要为图片"
        >
          📷 导出
        </button>
        <span className="text-xs text-gray-400 ml-auto">{saveLabel}</span>
      </header>
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        <div
          className="overflow-hidden"
          style={{ width: `${leftPct}%` }}
        >
          <TripBoard />
        </div>
        <div
          className="w-1.5 bg-gray-200 hover:bg-blue-400 cursor-col-resize flex-shrink-0 relative group"
          onMouseDown={() => {
            draggingRef.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-8 bg-gray-400 group-hover:bg-white rounded" />
        </div>
        <div
          className="overflow-hidden"
          style={{ width: `${100 - leftPct}%` }}
        >
          <MapView />
        </div>
      </div>
    </div>
  );
}
