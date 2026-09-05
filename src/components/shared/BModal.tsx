import type { ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
          <h4 className="modal-title">{title ?? t('AnnouncementsPage.Announcement')}</h4>
          <button type="button" className="btn-close shadow-none" aria-label="Close" onClick={onClose} />
        </div>
        <div className={'modal-body small' + (scrollable ? ' overflow-y-auto' : '')}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
