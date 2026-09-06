import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { BModal } from '@/components/shared/BModal';
import { Pagination } from '@/components/shared/Pagination';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { StatusCode } from '@/lib/models';
import { getCurrentLang, langStore } from '@/lib/i18n';
import { getCurrentUser } from '@/lib/user';
import { useStore } from '@/lib/store';
import { Announcement, AnnouncementType } from '@/features/announcements/announcement';
import '@/features/announcements/AnnouncementDialog.css';

const PAGE_SIZE = 10;

function isAdmin(): boolean {
  return getCurrentUser()?.roles?.some((r) => r.id === 5) ?? false;
}

/** 等价旧版 announcements.component */
export function AnnouncementsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const lang = useStore(langStore);

  const currentPage = Number(searchParams.get('page') ?? 1) || 1;
  const rawType = searchParams.get('type');
  const type = isValidType(rawType) ? (rawType!.toUpperCase() as AnnouncementType) : undefined;

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalElements, setTotalElements] = useState(0);
  const [detail, setDetail] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  const loadAnnouncements = useCallback(
    (page: number) => {
      setLoading(true);
      const base = isAdmin() ? 'api/admin/announcement/' : 'api/user/announcement/';
      void api
        .get(base, {
          lang: getCurrentLang(),
          page: page - 1,
          size: PAGE_SIZE,
          ...(type ? { type } : {}),
        })
        .then((resp) => {
          if (resp?.status) {
            if (resp.status.code === StatusCode.OK && resp.data) {
              setTotalElements(resp.data.totalElements);
              setAnnouncements(resp.data.content.map((a: any) => Announcement.fromJSON(a)));
            } else {
              notice(resp.status.message);
            }
            setLoading(false);
          }
        })
        .catch((error) => {
          notice(String(error));
          setLoading(false);
        });
    },
    [type],
  );

  useEffect(() => {
    loadAnnouncements(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, type, lang]);

  function isValidType(value: string | null): boolean {
    return !!value && Object.values(AnnouncementType).includes(value.toUpperCase() as AnnouncementType);
  }

  function pageChanged(page: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('page', String(page));
      return next;
    });
  }

  function setTypeFilter(nextType: AnnouncementType | undefined) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('page');
      if (nextType) next.set('type', nextType.toLowerCase());
      else next.delete('type');
      return next;
    });
  }

  function showAnnouncement(announcement: Announcement) {
    const base = isAdmin() ? 'api/admin/announcement/' : 'api/user/announcement/';
    void api
      .get(base + announcement.id, { lang: getCurrentLang() })
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK && resp.data) {
            setDetail(Announcement.fromJSON(resp.data));
          } else {
            notice(resp.status.message);
          }
        }
      })
      .catch((error) => notice(String(error)));
  }

  function itemContext(e: React.MouseEvent, id: number) {
    if (isAdmin()) {
      navigate(`/announcements/edit?id=${id}`);
      e.preventDefault();
    }
  }

  function deleteAnnouncement(announcement: Announcement) {
    void api
      .delete('api/admin/announcement/' + announcement.id)
      .then((resp) => {
        if (resp?.status?.code === StatusCode.OK) {
          loadAnnouncements(currentPage);
        } else {
          notice(resp?.status?.message);
        }
        setDeleting(null);
      })
      .catch((error) => {
        notice(String(error));
        setDeleting(null);
      });
  }

  const chips: Array<[AnnouncementType | undefined, string]> = [
    [undefined, t('AnnouncementsPage.All')],
    [AnnouncementType.GENERAL, t('AnnouncementsPage.General')],
    [AnnouncementType.MAINTENANCE, t('AnnouncementsPage.Maintenance')],
    [AnnouncementType.UPDATE, t('AnnouncementsPage.Update')],
    [AnnouncementType.EVENT, t('AnnouncementsPage.Event')],
    [AnnouncementType.TUTORIAL, t('AnnouncementsPage.Tutorial')],
    [AnnouncementType.OTHER, t('AnnouncementsPage.Other')],
  ];

  const typeBadge: Record<string, string> = {
    GENERAL: 'bg-primary',
    MAINTENANCE: 'bg-warning',
    UPDATE: 'bg-info',
    EVENT: 'bg-orange',
    TUTORIAL: 'bg-teal',
    OTHER: 'bg-gray',
  };

  return (
    <div className="content">
      <h1 className="page-heading">{t('AnnouncementsPage.Title')}</h1>

      {isAdmin() && (
        <Link className="btn btn-sm btn-primary mb-2" to="edit">
          {t('AnnouncementsPage.DraftNew')}
        </Link>
      )}

      <div className="row mb-2 g-1">
        <div className="col-12 col-sm">
          <div className="row justify-content-start align-items-center g-1">
            {chips.map(([value, label]) => (
              <div className="col-auto" key={label}>
                <button
                  className={'tab-selector' + (type === value ? ' tab-selector-active' : '')}
                  onClick={() => setTypeFilter(value)}
                >
                  {label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Pagination
        current={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={totalElements}
        onPageChange={pageChanged}
      />

      {loading && (
        <div className="placeholder-glow my-1">
          <div>
            <div className="placeholder fw-light text-secondary" style={{ width: '8em' }} />
          </div>
          <div>
            <h4 className="placeholder" style={{ width: '12em' }} />
          </div>
        </div>
      )}

      {!loading && announcements && announcements.length === 0 && (
        <div>
          <div className="card user-select-none mb-2">
            <div className="card-body">没有公告</div>
          </div>
        </div>
      )}

      {!loading && announcements && announcements.length > 0 && (
        <div>
          <div className="card user-select-none mb-2">
            <ul className="list-group list-group-flush">
              {announcements.map((announcement) => (
                <li
                  key={announcement.id}
                  className="list-group-item card-btn"
                  onClick={() => showAnnouncement(announcement)}
                  onContextMenu={(e) => itemContext(e, announcement.id)}
                >
                  <div className="d-flex align-items-center gap-1 mb-1">
                    <div className="fw-light small text-secondary">
                      {announcement.updatedAt.toLocaleDateString()}
                    </div>
                    <span className={typeBadge[announcement.type] + ' badge rounded-pill'}>
                      {t('AnnouncementsPage.' + typeToLabel(announcement.type))}
                    </span>
                    {isAdmin() && announcement.status === 'DRAFT' && (
                      <span className="bg-secondary badge rounded-pill">{t('AnnouncementsPage.Draft')}</span>
                    )}
                    {isAdmin() && announcement.status === 'EXPIRED' && (
                      <span className="bg-danger badge rounded-pill">{t('AnnouncementsPage.Expired')}</span>
                    )}
                    {announcement.priority > 0 && (
                      <span className="bg-danger-subtle text-danger badge rounded-pill border-danger-subtle border-1 border-solid">
                        {t('AnnouncementsPage.Pinned')}
                      </span>
                    )}
                    {isAdmin() && (
                      <button
                        className="btn btn-outline-danger btn-sm ms-auto py-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleting(announcement);
                        }}
                      >
                        {t('AnnouncementsPage.Delete')}
                      </button>
                    )}
                  </div>
                  <h4 className="mb-1">{announcement.getLocalTitle(getCurrentLang())}</h4>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <Pagination
        current={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={totalElements}
        onPageChange={pageChanged}
      />

      <BModal
        className="announcement-detail-dialog"
        open={!!detail}
        onClose={() => setDetail(null)}
        scrollable
      >
        {detail && (
          <div
            className="announcement-content"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                marked.parse(detail.getLocalContent(getCurrentLang())) as string,
              ),
            }}
          />
        )}
      </BModal>

      <BModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={t('AnnouncementsPage.Delete')}
      >
        <form>
          <div className="d-grid">
            <p className="mb-3 ms-1">{t('AnnouncementsPage.DeleteTip')}</p>
            <button className="btn btn-danger btn-sm" onClick={() => deleting && deleteAnnouncement(deleting)}>
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>
    </div>
  );
}

function typeToLabel(type: AnnouncementType): string {
  switch (type) {
    case AnnouncementType.GENERAL:
      return 'General';
    case AnnouncementType.MAINTENANCE:
      return 'Maintenance';
    case AnnouncementType.UPDATE:
      return 'Update';
    case AnnouncementType.EVENT:
      return 'Event';
    case AnnouncementType.TUTORIAL:
      return 'Tutorial';
    default:
      return 'Other';
  }
}
