import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** 等价旧版 dialog.service.ts / dialog.component.ts：全局 yes/no 确认框（默认 确定/取消） */

interface ConfirmOptions {
  title?: string;
  message: string;
  yesText?: string;
  noText?: string;
}

let container: HTMLDivElement | null = null;

export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  return new Promise((resolve) => {
    if (!container) {
      container = document.createElement('div');
      document.body.appendChild(container);
    }
    const root = createRoot(container);

    const cleanup = (result: boolean) => {
      root.unmount();
      resolve(result);
    };

    root.render(<ConfirmDialogRoot opts={opts} onDone={cleanup} />);
  });
}

function ConfirmDialogRoot({
  opts,
  onDone,
}: {
  opts: ConfirmOptions;
  onDone: (result: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setOpen(false);
          onDone(false);
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle>{opts.title ?? '确认'}</DialogTitle>
        <p className="text-[var(--bs-body-color)]">{opts.message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onDone(false)}>
            {opts.noText ?? '取消'}
          </Button>
          <Button onClick={() => onDone(true)}>{opts.yesText ?? '确定'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
