import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useTripStore, getSnapshot } from '../../stores/tripStore';
import DayColumn from '../day/DayColumn';

export default function TripBoard() {
  const snapshot = useTripStore((s) => getSnapshot(s));
  const moveNode = useTripStore((s) => s.moveNode);
  const addDay = useTripStore((s) => s.addDay);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const a = active.data.current as { dayId: string; order: number } | undefined;
    if (!a) return;
    let toDayId: string;
    let toIndex: number;
    if (String(over.id).startsWith('day:')) {
      toDayId = String(over.id).slice(4);
      const day = snapshot.days.find((d) => d.id === toDayId);
      toIndex = day ? day.nodes.length : 0;
    } else {
      const o = over.data.current as { dayId: string; order: number };
      toDayId = o.dayId;
      toIndex = o.order;
    }
    if (a.dayId === toDayId && a.order === toIndex) return;
    moveNode(String(active.id), a.dayId, a.order, toDayId, toIndex);
  };

  return (
    <div className="h-full overflow-y-auto">
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex flex-col gap-3 p-3 h-full items-stretch">
          {snapshot.days.map((d, i) => (
            <DayColumn key={d.id} day={d} index={i} />
          ))}
          <button
            onClick={addDay}
            className="bg-white border border-dashed border-blue-300 rounded-xl w-full p-3 text-blue-600 hover:bg-blue-50"
          >
            + 新增行程日
          </button>
        </div>
      </DndContext>
    </div>
  );
}
