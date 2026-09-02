import type { ReactNode } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';

/** Bootstrap 观感的模态框（modal-header/title/body 结构，等价旧版 NgbModal） */
export function BModal({
  open,
  onClose,
  title,
  children,
  scrollable = false,
  wide = false,
}: {
  open: boolean;
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
        className={
          'bg-[var(--bs-body-bg)] border border-[var(--bs-border-color)] rounded-[var(--bs-border-radius-lg)] shadow-[var(--bs-box-shadow-lg)] p-0 gap-0 max-h-[85vh] ' +
          (wide ? 'max-w-3xl' : 'max-w-lg') +
          (scrollable ? ' overflow-hidden flex flex-col' : '')
        }
      >
        <div className="modal-header">
          <h4 className="modal-title">{title ?? t('AnnouncementsPage.Announcement')}</h4>
          <button type="button" className="btn-close shadow-none" aria-label="Close" onClick={onClose} />
        </div>
        <div className={'modal-body small ' + (scrollable ? 'overflow-y-auto' : '')}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
