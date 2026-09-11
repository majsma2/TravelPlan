import { useState } from 'react';
import { useTripStore } from '../../stores/tripStore';

export default function Landing() {
  const createTrip = useTripStore((s) => s.createTrip);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    setBusy(true);
    try {
      await createTrip(title.trim() || '我的自驾行程');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
        <div className="text-5xl mb-3">🚗</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">自驾行程助手</h1>
        <p className="text-gray-500 text-sm mb-6">
          基于高德地图自动计算自驾里程与耗时，时序自动联动。
        </p>
        <input
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="行程名称（可选）"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreate()}
        />
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition"
          onClick={onCreate}
          disabled={busy}
        >
          {busy ? '创建中…' : '开始规划行程'}
        </button>
        <p className="text-xs text-gray-400 mt-4">
          创建后将生成专属链接，无需登录，可在多设备打开。
        </p>
      </div>
    </div>
  );
}
