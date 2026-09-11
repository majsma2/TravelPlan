import { useUIStore } from '../../stores/uiStore';

const STYLES: Record<string, string> = {
  info: 'bg-blue-600',
  success: 'bg-emerald-600',
  warn: 'bg-amber-600',
  error: 'bg-rose-600',
};

export default function ToastHost() {
  const toasts = useUIStore((s) => s.toasts);
  const dismiss = useUIStore((s) => s.dismissToast);
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${STYLES[t.type]} text-white px-4 py-2 rounded-lg shadow-lg text-sm max-w-sm cursor-pointer`}
          onClick={() => dismiss(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
