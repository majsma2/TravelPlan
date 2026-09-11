import { useEffect } from 'react';
import { useTripStore } from './stores/tripStore';
import TripManager from './components/layout/TripManager';
import AppShell from './components/layout/AppShell';
import ToastHost from './components/layout/ToastHost';
import NodeEditor from './components/node/NodeEditor';

export default function App() {
  const init = useTripStore((s) => s.init);
  const status = useTripStore((s) => s.status);
  const view = useTripStore((s) => s.view);

  useEffect(() => {
    void init();
  }, [init]);

  // 编辑模式下加载中
  if (view === 'edit' && status === 'loading') {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        载入中…
      </div>
    );
  }

  // 编辑模式
  if (view === 'edit') {
    if (status === 'ready') {
      return (
        <>
          <AppShell />
          <ToastHost />
          <NodeEditor />
        </>
      );
    }
    if (status === 'error') {
      return (
        <div className="h-full flex items-center justify-center text-rose-500">
          行程不存在或加载失败
        </div>
      );
    }
  }

  // 默认：行程管理列表
  return (
    <>
      <TripManager />
      <ToastHost />
    </>
  );
}
