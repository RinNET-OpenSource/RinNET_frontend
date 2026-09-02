import { useEffect } from 'react';
import { toastStore, removeToast, type Toast } from '@/lib/message';
import { useStore } from '@/lib/store';

function ToastItem({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 等价 bootstrap toast：默认 body 配色；text-bg-* 彩色变体
  const colorClass =
    toast.classname === 'text-bg-danger'
      ? 'bg-[#dc3545] text-white border-black/10'
      : toast.classname === 'text-bg-warning'
        ? 'bg-[#ffc107] text-[#212529] border-black/10'
        : toast.classname === 'text-bg-success'
          ? 'bg-[#198754] text-white border-black/10'
          : 'bg-[var(--bs-body-bg)] text-[var(--bs-body-color)] border border-[var(--bs-border-color)]';

  return (
    <div
      className={`pointer-events-auto w-[350px] max-w-full rounded-[var(--bs-border-radius)] shadow-[var(--bs-box-shadow)] ${colorClass}`}
      style={{ wordBreak: 'break-word' }}
    >
      <div className="p-3 text-[0.875rem]">{toast.text}</div>
    </div>
  );
}

/** 等价旧版 toasts-container.component.tsx：固定右上（navbar 下方），z-1200 */
export function Toasts() {
  const toasts = useStore(toastStore);
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed end-0 top-0 z-[1200] flex flex-col gap-2 p-3"
      style={{ marginTop: '3.6rem' }}
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
