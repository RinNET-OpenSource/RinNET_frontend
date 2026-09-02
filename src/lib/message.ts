import { createStore } from '@/lib/store';

/** 等价旧版 toast-service.ts + message.service.ts */

export type ToastColor = 'danger' | 'warning' | 'success' | null;

export interface Toast {
  id: number;
  text: string;
  classname: string | null;
}

export const toastStore = createStore<Toast[]>([]);
let nextId = 1;

export function showToast(text: string, classname: string | null = null) {
  toastStore.set([...toastStore.get(), { id: nextId++, text, classname }]);
}

export function removeToast(toast: Toast) {
  toastStore.set(toastStore.get().filter((t) => t !== toast));
}

export function clearToasts() {
  toastStore.set([]);
}

/** 等价旧版 MessageService.notice(message, color) */
export function notice(message: string, color: ToastColor = null) {
  if (color === 'danger') {
    showToast(message, 'text-bg-danger');
  } else if (color === 'warning') {
    showToast(message, 'text-bg-warning');
  } else if (color === 'success') {
    showToast(message, 'text-bg-success');
  } else {
    showToast(message);
  }
}
