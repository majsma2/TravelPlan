import { useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';

function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TripManager() {
  const tripsList = useTripStore((s) => s.tripsList);
  const listLoading = useTripStore((s) => s.listLoading);
  const createTrip = useTripStore((s) => s.createTrip);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const copyTrip = useTripStore((s) => s.copyTrip);
  const selectTrip = useTripStore((s) => s.selectTrip);
  const listTrips = useTripStore((s) => s.listTrips);
  const pushToast = useUIStore((s) => s.pushToast);

  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const onCreate = async () => {
    setCreating(true);
    try {
      await createTrip(newTitle.trim() || '我的自驾行程');
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (token: string, title: string) => {
    if (!window.confirm(`确定删除「${title}」吗？此操作不可恢复。`)) return;
    await deleteTrip(token);
  };

  const onEdit = async (token: string) => {
    await selectTrip(token);
  };

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">🚗 我的自驾行程</h1>
        <p className="text-sm text-gray-500 mb-6">管理所有行程计划，点击「编辑」进入行程规划。</p>

        {/* 新建行程 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="新行程名称（可选）"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCreate()}
            />
            <button
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition"
              onClick={onCreate}
              disabled={creating}
            >
              {creating ? '创建中…' : '+ 新建行程'}
            </button>
          </div>
        </div>

        {/* 行程列表 */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">
            行程列表{tripsList.length > 0 && `（${tripsList.length}）`}
          </h2>
          <button
            className="text-sm text-blue-600 hover:underline"
            onClick={() => listTrips()}
          >
            🔄 刷新
          </button>
        </div>

        {listLoading && tripsList.length === 0 && (
          <div className="text-center text-gray-400 py-12">加载中…</div>
        )}

        {!listLoading && tripsList.length === 0 && (
          <div className="text-center text-gray-400 py-16 border border-dashed rounded-xl bg-white">
            还没有行程，点击上方「新建行程」开始规划吧
          </div>
        )}

        <div className="space-y-3">
          {tripsList.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-800 truncate">
                    {t.title || '未命名行程'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>📅 开始 {formatDate(t.start_date)}</span>
                    <span>🗓️ {t.days_count} 天</span>
                    <span>📍 {t.nodes_count} 个节点</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    更新于 {formatDateTime(t.updated_at)}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="text-sm text-gray-600 hover:bg-gray-100 border border-gray-300 px-3 py-1.5 rounded-lg"
                    onClick={() => copyTrip(t.token)}
                  >
                    复制
                  </button>
                  <button
                    className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg"
                    onClick={() => onEdit(t.token)}
                  >
                    编辑
                  </button>
                  <button
                    className="text-sm text-rose-600 hover:bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg"
                    onClick={() => onDelete(t.token, t.title || '未命名行程')}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
