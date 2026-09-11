import { create } from 'zustand';

export interface Toast {
  id: number;
  type: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

interface UIState {
  toasts: Toast[];
  editingNodeId: string | null; // 当前编辑节点 id
  selectedNodeId: string | null; // 列表/地图选中联动
  selectedSegmentKey: string | null;
  pushToast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: number) => void;
  setEditingNode: (id: string | null) => void;
  selectNode: (id: string | null) => void;
  selectSegment: (key: string | null) => void;
}

let toastSeq = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  editingNodeId: null,
  selectedNodeId: null,
  selectedSegmentKey: null,
  pushToast: (type, message) => {
    const id = ++toastSeq;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setEditingNode: (id) => set({ editingNodeId: id }),
  selectNode: (id) => set({ selectedNodeId: id }),
  selectSegment: (key) => set({ selectedSegmentKey: key }),
}));
