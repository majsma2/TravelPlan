import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import {
  useTripStore,
  selectDayTotals,
  selectPrevDayHotel,
} from '../../stores/tripStore';
import { metersToKm, humanDuration } from '../../utils/format';
import NodeCard from '../node/NodeCard';
import DrivingSegmentRow from '../segment/DrivingSegmentRow';
import type { DayData } from '../../types/domain';

export default function DayColumn({ day, index }: { day: DayData; index: number }) {
  const addNode = useTripStore((s) => s.addNode);
  const copyDay = useTripStore((s) => s.copyDay);
  const clearDay = useTripStore((s) => s.clearDay);
  const deleteDay = useTripStore((s) => s.deleteDay);
  const setDayDepartureTime = useTripStore((s) => s.setDayDepartureTime);
  const locked = useTripStore((s) => s.trip?.locked === 1);
  const totals = useTripStore((s) => selectDayTotals(s, day.id));
  const prevHotel = useTripStore((s) => selectPrevDayHotel(s, day.id));
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day.id}` });

  const nodeIds = day.nodes.map((n) => n.id);

  return (
    <div
      className={`bg-gray-50 rounded-xl p-3 w-full border ${
        isOver ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-bold text-gray-800 whitespace-nowrap">第 {index + 1} 天</span>
          <span className="font-bold text-gray-500 whitespace-nowrap">{day.date}</span>
        </div>
        <div className="flex gap-2 text-sm shrink-0">
          {!locked && (
            <>
              <button
                className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded px-2 py-0.5"
                onClick={() => copyDay(day.id)}
              >
                复制
              </button>
              <button
                className="text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded px-2 py-0.5"
                onClick={() => clearDay(day.id)}
              >
                清空
              </button>
              <button
                className="text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded px-2 py-0.5"
                onClick={() => deleteDay(day.id)}
              >
                删除
              </button>
            </>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500 bg-white rounded px-2 py-1 mb-2 flex gap-3">
        <span>🛣️ {metersToKm(totals.distance)}公里</span>
        <span>⏱️ {humanDuration(totals.duration)}</span>
      </div>

      <SortableContext items={nodeIds} strategy={horizontalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-[120px] flex gap-2 overflow-x-auto pb-2 items-stretch">
          {prevHotel && (
            <div className="flex flex-col gap-1 shrink-0 w-72">
              <div className="w-full text-xs text-gray-300 bg-gray-100 rounded-lg py-1.5 px-2 flex items-center gap-1">
                <span>🚗</span>
              </div>
              <div className="flex-1 bg-amber-50 border border-amber-200 rounded-lg p-3 flex flex-col justify-center">
                <div className="text-xs text-amber-600">起点（前日酒店）</div>
                <div className="font-medium text-gray-800 truncate">🏨 {prevHotel.name || '未命名酒店'}</div>
                <div className="text-xs text-gray-400 truncate">{prevHotel.address || '未设置地址'}</div>
              </div>
              <div className="w-full text-xs bg-gray-100 rounded-lg py-1.5 px-2 flex items-center gap-2">
                <span>🚗</span>
                <span className="text-gray-600">出发</span>
                <input
                  type="time"
                  className="border rounded px-1 py-0.5 text-xs bg-white"
                  value={day.departure_time ?? ''}
                  onChange={(e) =>
                    setDayDepartureTime(day.id, e.target.value || null)
                  }
                />
              </div>
            </div>
          )}
          {day.nodes.map((n, i) => {
            const segPrev = i === 0 ? prevHotel : day.nodes[i - 1];
            return (
              <div key={n.id} className="flex flex-col gap-1 shrink-0 w-72">
                {segPrev ? (
                  <DrivingSegmentRow prev={segPrev} next={n} />
                ) : (
                  <div className="w-full text-xs text-gray-300 bg-gray-100 rounded-lg py-1.5 px-2 flex items-center gap-1">
                    <span>🚗</span>
                  </div>
                )}
                <NodeCard node={n} index={i} />
                <div className="w-full text-xs bg-gray-100 rounded-lg py-1.5 px-2 flex items-center gap-2">
                  <span>🚗</span>
                  <span className="text-gray-600">抵达</span>
                  <span className="bg-green-500 text-white rounded-full px-4 py-0.5 font-mono text-sm">{n.arrive_time ?? '--:--'}</span>
                  {i < day.nodes.length - 1 && (
                    <>
                      <span className="text-gray-600">离开</span>
                      <span className="bg-orange-500 text-white rounded-full px-4 py-0.5 font-mono text-sm">{n.leave_time ?? '--:--'}</span>
                    </>
                  )}
                  {/* <span className="text-gray-400 ml-auto">游玩 {n.play_duration}分</span> */}
                </div>
              </div>
            );
          })}
          {day.nodes.length === 0 && !prevHotel && (
            <div className="flex-1 text-center text-xs text-gray-400 py-6 border border-dashed rounded-lg">
              拖拽或点击下方添加节点
            </div>
          )}
          {day.nodes.length === 0 && prevHotel && (
            <div className="flex-1 text-center text-xs text-gray-400 py-6 border border-dashed rounded-lg">
              已从前日酒店出发，点击下方添加节点
            </div>
          )}
        </div>
      </SortableContext>

      {!locked && (
        <button
          className="w-full mt-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg py-2 border border-dashed border-blue-300"
          onClick={() => addNode(day.id)}
        >
          + 添加节点
        </button>
      )}
    </div>
  );
}
