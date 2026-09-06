import { useId, useLayoutEffect, type ReactNode } from 'react';
import { LiquidDialog } from '@liquefy-ui/react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTheme } from '@/lib/theme';
import { useTranslation } from 'react-i18next';

/** Bootstrap 观感的模态框（modal-header/title/body 结构，等价旧版 NgbModal） */
export function BModal({
  open,
  onClose,
  title,
  children,
  className = '',
  overlayClassName,
  scrollable = false,
  wide = false,
}: {
  className?: string;
  open: boolean;
  overlayClassName?: string;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  scrollable?: boolean;
  wide?: boolean;
}) {
  const { t } = useTranslation();
  const { family } = useTheme();
  const dialogId = useId();
  const overlayClasses = overlayClassName?.split(/\s+/).filter(Boolean) ?? [];
  const resolvedTitle = title ?? t('AnnouncementsPage.Announcement');

  useLayoutEffect(() => {
    if (family !== 'liquefy' || !open || overlayClasses.length === 0) return;

    const dialog = document.querySelector<HTMLElement>(`[data-bmodal-id="${dialogId}"]`);
    const backdrop = dialog?.previousElementSibling;
    if (!backdrop) return;

    backdrop.classList.add(...overlayClasses);
    return () => backdrop.classList.remove(...overlayClasses);
  }, [dialogId, family, open, overlayClasses.join(' ')]);

  if (family === 'liquefy') {
    return (
      <LiquidDialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) onClose();
        }}
        closeLabel={t('Common.Close')}
        data-bmodal-id={dialogId}
        title={resolvedTitle}
        className={
          'liquefy-modal' +
          (wide ? ' liquefy-modal--wide' : '') +
          (scrollable ? ' liquefy-modal--scrollable' : '') +
          (className ? ` ${className}` : '')
        }
      >
        <div className={scrollable ? 'overflow-y-auto' : undefined}>{children}</div>
      </LiquidDialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={overlayClassName}
        className={
          'compat-modal bg-popover border border-border rounded-[0.5rem] shadow-md p-0 gap-0 text-popover-foreground text-sm sm:max-w-[500px]' +
          (wide ? ' compat-lg' : '') +
          (scrollable ? ' compat-scrollable' : '') +
          (className ? ` ${className}` : '')
        }
      >
        <div className="modal-header">
          <h4 className="modal-title">{resolvedTitle}</h4>
          <button type="button" className="btn-close shadow-none" aria-label="Close" onClick={onClose} />
        </div>
        <div className={'modal-body small' + (scrollable ? ' overflow-y-auto' : '')}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
