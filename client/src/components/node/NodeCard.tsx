import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { NODE_TYPE_ICONS } from '../../types/domain';
import type { NodeData } from '../../types/domain';

export default function NodeCard({
  node,
  index,
}: {
  node: NodeData;
  index: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: node.id,
      data: { dayId: node.day_id, order: node.order },
    });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const setEditingNode = useUIStore((s) => s.setEditingNode);
  const selectNode = useUIStore((s) => s.selectNode);
  const selected = useUIStore((s) => s.selectedNodeId === node.id);
  const deleteNode = useTripStore((s) => s.deleteNode);
  const locked = useTripStore((s) => s.trip?.locked === 1);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg shadow-sm border p-3 w-72 shrink-0 flex-1 ${
        selected ? 'border-blue-500 ring-1 ring-blue-300' : 'border-gray-200'
      } ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-start gap-2">
        {!locked && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-gray-400 mt-0.5 select-none"
            title="拖拽排序"
          >
            ⠿
          </button>
        )}
        <div
          className="flex-1 cursor-pointer"
          onClick={() => {
            selectNode(node.id);
            setEditingNode(node.id);
          }}
        >
          <div className="flex items-center gap-2">
            <span>{NODE_TYPE_ICONS[node.type]}</span>
            <span className="font-medium text-gray-800">
              {index + 1}. {node.name || '未命名节点'}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5 truncate">
            {node.address || '未设置地址'}
          </div>
          {node.note && (
            <div className="text-xs text-gray-400 mt-1 truncate">📝 {node.note}</div>
          )}
        </div>
        {!locked && (
          <button
            className="text-gray-300 hover:text-rose-500 text-sm px-1"
            title="删除节点"
            onClick={() => deleteNode(node.id)}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
