import { useEffect, useRef, useState } from 'react';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import { placeSearch } from '../../services/amapJs';
import { apiClient } from '../../services/apiClient';
import { NODE_TYPE_LABELS } from '../../types/domain';
import type { NodeData, NodeType, TripPayload } from '../../types/domain';

function findNode(trip: TripPayload | null, id: string | null) {
  if (!trip || !id) return null;
  for (const d of trip.days) {
    const n = d.nodes.find((x) => x.id === id);
    if (n) return { node: n, dayId: d.id, isFirst: d.nodes[0]?.id === id };
  }
  return null;
}

export default function NodeEditor() {
  const editingNodeId = useUIStore((s) => s.editingNodeId);
  const setEditingNode = useUIStore((s) => s.setEditingNode);
  const pushToast = useUIStore((s) => s.pushToast);
  const trip = useTripStore((s) => s.trip);
  const autoLink = useTripStore((s) => s.trip?.auto_link === 1);
  const locked = useTripStore((s) => s.trip?.locked === 1);
  const updateNode = useTripStore((s) => s.updateNode);

  const found = findNode(trip, editingNodeId);
  const node: NodeData | null = found?.node ?? null;
  const dayId = found?.dayId ?? '';
  const isFirst = found?.isFirst ?? false;
  const dayHasOtherHotel =
    !!trip &&
    !!node &&
    (trip.days
      .find((d) => d.id === dayId)
      ?.nodes.some((n) => n.id !== node.id && n.type === 'hotel') ?? false);

  const [addr, setAddr] = useState('');
  const [suggestions, setSuggestions] = useState<
    Array<{ name: string; address: string; lng: number; lat: number }>
  >([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (node) setAddr(node.address);
  }, [editingNodeId]); // eslint-disable-line

  const onAddrInput = (v: string) => {
    setAddr(v);
    updateNodeLocal({ address: v });
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (v.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await placeSearch(v.trim());
        setSuggestions(res);
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const updateNodeLocal = (partial: Partial<NodeData>) => {
    if (editingNodeId) updateNode(editingNodeId, partial);
  };

  const pickSuggestion = (s: (typeof suggestions)[number]) => {
    setAddr(s.address);
    setSuggestions([]);
    updateNodeLocal({
      name: s.name,
      address: s.address,
      lng: s.lng,
      lat: s.lat,
    });
    pushToast('success', `已定位：${s.name}`);
  };

  const onUploadImage = async (file: File) => {
    const fd = new FormData();
    fd.append('image', file);
    try {
      const { data } = await apiClient.post('/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imgs = [...(node?.images ?? []), data.url];
      updateNodeLocal({ images: imgs });
    } catch {
      pushToast('error', '图片上传失败');
    }
  };

  if (!node) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-bold text-gray-800">编辑节点</h3>
          <button
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg"
            onClick={() => setEditingNode(null)}
          >
            保存
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-500">名称</label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              value={node.name}
              onChange={(e) => updateNodeLocal({ name: e.target.value })}
              placeholder="节点名称"
              disabled={locked}
            />
          </div>

          <div className="relative">
            <label className="text-xs text-gray-500">
              地址（输入关键字搜索高德 POI）
            </label>
            <input
              className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              value={addr}
              onChange={(e) => onAddrInput(e.target.value)}
              placeholder="如：宽窄巷子"
              disabled={locked}
            />
            {searching && (
              <div className="text-xs text-gray-400 mt-1">搜索中…</div>
            )}
            {suggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-0"
                    onClick={() => pickSuggestion(s)}
                  >
                    <div className="text-sm text-gray-800">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.address}</div>
                  </button>
                ))}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              {node.lng != null ? `坐标 ${node.lng.toFixed(5)}, ${node.lat?.toFixed(5)}` : '未定位坐标，无法算路'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">类型</label>
              <select
                className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                value={node.type}
                onChange={(e) => updateNodeLocal({ type: e.target.value as NodeType })}
                disabled={locked}
              >
                {Object.entries(NODE_TYPE_LABELS).map(([k, v]) => {
                  const disabled = k === 'hotel' && dayHasOtherHotel;
                  return (
                    <option key={k} value={k} disabled={disabled}>
                      {v}
                      {disabled ? '（每天仅一个）' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">游玩时长(分钟)</label>
              <input
                type="number"
                className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                value={node.play_duration}
                onChange={(e) =>
                  updateNodeLocal({ play_duration: Math.max(0, parseInt(e.target.value) || 0) })
                }
                disabled={locked}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">
                {isFirst ? '出发时间' : '抵达时间'}
                {autoLink && !isFirst && (
                  <span className="text-gray-400">（自动联动）</span>
                )}
              </label>
              <input
                type="time"
                className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                value={node.arrive_time ?? ''}
                disabled={locked || (autoLink && !isFirst)}
                onChange={(e) =>
                  updateNodeLocal({ arrive_time: e.target.value, manual_time: 1 })
                }
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">
                离开时间
                {autoLink && <span className="text-gray-400">（自动联动）</span>}
              </label>
              <input
                type="time"
                className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                value={node.leave_time ?? ''}
                disabled={locked || autoLink}
                onChange={(e) =>
                  updateNodeLocal({ leave_time: e.target.value, manual_time: 1 })
                }
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500">备注</label>
            <textarea
              className="w-full border rounded-lg px-3 py-2 mt-1 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              rows={2}
              value={node.note}
              onChange={(e) => updateNodeLocal({ note: e.target.value })}
              disabled={locked}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500">图片</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {node.images.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt=""
                  className="w-16 h-16 object-cover rounded border"
                />
              ))}
              {!locked && (
                <label className="w-16 h-16 flex items-center justify-center border-2 border-dashed rounded cursor-pointer text-gray-400 hover:border-blue-400">
                +
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadImage(f);
                  }}
                />
                </label>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
