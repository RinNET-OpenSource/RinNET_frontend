import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { BModal } from '@/components/shared/BModal';
import { Announcement, AnnouncementStatus, AnnouncementType } from '@/features/announcements/announcement';
import { api } from '@/lib/api/client';
import { languages } from '@/lib/i18n';
import { notice } from '@/lib/message';
import { StatusCode } from '@/lib/models';
import '@/features/announcements/AnnouncementDialog.css';
import './AnnouncementEditPage.css';

/** Equivalent to the legacy announcement editor. */
export function AnnouncementEditPage() {
  const [searchParams] = useSearchParams();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [activeTab, setActiveTab] = useState('zh');
  const [previewOpen, setPreviewOpen] = useState(false);
  const id = Number(searchParams.get('id')) || 0;

  useEffect(() => {
    if (!id) {
      const value = new Announcement();
      value.type = AnnouncementType.GENERAL;
      value.priority = 0;
      setAnnouncement(value);
      return;
    }
    void api
      .get(`api/admin/announcement/${id}`)
      .then((response) => {
        if (response?.status?.code === StatusCode.OK && response.data) {
          setAnnouncement(Announcement.fromJSON(response.data));
        } else {
          notice(response?.status?.message);
        }
      })
      .catch((error) => notice(String(error)));
  }, [id]);

  const updateAnnouncement = (apply: (draft: Announcement) => void) => {
    setAnnouncement((current) => {
      if (!current) return current;
      const next = Object.assign(new Announcement(), current);
      next.translations = current.translations.map((translation) => ({ ...translation }));
      apply(next);
      return next;
    });
  };

  const post = async (status: AnnouncementStatus) => {
    if (!announcement) return;
    const data: Record<string, unknown> = announcement.id === undefined
      ? {
          title: announcement.title,
          content: announcement.content,
          translations: announcement.translations,
          type: announcement.type,
          status,
          updatedAt: Date.now(),
          priority: announcement.priority,
        }
      : { ...announcement, status };
    if (status === AnnouncementStatus.EXPIRED || status === AnnouncementStatus.DRAFT) {
      data.updatedAt = announcement.updatedAt;
    }
    try {
      const response = await api.post('api/admin/announcement', data);
      notice(response?.status?.message);
    } catch (error) {
      notice(String(error));
    }
  };

  const previewTitle = announcement?.getLocalTitle(activeTab) ?? '';
  const previewContent = announcement?.getLocalContent(activeTab) ?? '';

  return (
    <div className="content announcement-edit-page">
      <h1 className="page-heading">撰写公告</h1>
      {announcement && (
        <>
          <ul className="nav nav-tabs mb-3" id="myTab" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link${activeTab === 'zh' ? ' active' : ''}`}
                id="zh-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'zh'}
                onClick={() => setActiveTab('zh')}
              >
                简体中文
              </button>
            </li>
            {announcement.translations.map((translation) => (
              <li className="nav-item" role="presentation" key={translation.language}>
                <button
                  className={`nav-link${activeTab === translation.language ? ' active' : ''}`}
                  id={`${translation.language}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === translation.language}
                  onClick={() => setActiveTab(translation.language)}
                >
                  {languages.get(translation.language)}
                </button>
              </li>
            ))}
          </ul>

          <div className="tab-content" id="myTabContent">
            <div
              className={`tab-pane${activeTab === 'zh' ? ' show active' : ''}`}
              id="zh-tab-pane"
              role="tabpanel"
              aria-labelledby="zh-tab"
              tabIndex={0}
            >
              <input
                className="form-control mb-3"
                placeholder="标题"
                value={announcement.title}
                onChange={(event) => updateAnnouncement((draft) => { draft.title = event.target.value; })}
              />
              <textarea
                className="form-control announcement-content mb-3"
                placeholder="内容"
                value={announcement.content}
                onChange={(event) => updateAnnouncement((draft) => { draft.content = event.target.value; })}
              />
            </div>
            {announcement.translations.map((translation) => (
              <div
                className={`tab-pane${activeTab === translation.language ? ' show active' : ''}`}
                id={`${translation.language}-tab-pane`}
                role="tabpanel"
                aria-labelledby={`${translation.language}-tab`}
                tabIndex={0}
                key={translation.language}
              >
                <input
                  className="form-control mb-3"
                  placeholder="Title"
                  value={translation.translatedTitle}
                  onChange={(event) => updateAnnouncement((draft) => {
                    const target = draft.translations.find((item) => item.language === translation.language);
                    if (target) target.translatedTitle = event.target.value;
                  })}
                />
                <textarea
                  className="form-control announcement-content mb-3"
                  placeholder="Content"
                  value={translation.translatedContent}
                  onChange={(event) => updateAnnouncement((draft) => {
                    const target = draft.translations.find((item) => item.language === translation.language);
                    if (target) target.translatedContent = event.target.value;
                  })}
                />
              </div>
            ))}

            <select
              className="form-select mb-3"
              value={announcement.type}
              onChange={(event) => updateAnnouncement((draft) => { draft.type = event.target.value as AnnouncementType; })}
            >
              <option value={AnnouncementType.GENERAL}>一般</option>
              <option value={AnnouncementType.MAINTENANCE}>维护</option>
              <option value={AnnouncementType.UPDATE}>更新</option>
              <option value={AnnouncementType.EVENT}>活动</option>
              <option value={AnnouncementType.TUTORIAL}>教程</option>
              <option value={AnnouncementType.OTHER}>其它</option>
            </select>
            <select
              className="form-select mb-3"
              value={announcement.priority}
              onChange={(event) => updateAnnouncement((draft) => { draft.priority = Number(event.target.value); })}
            >
              <option value={0}>不置顶</option>
              <option value={1}>重要</option>
              <option value={2}>置顶</option>
            </select>
            <div className="d-flex gap-2 mb-3">
              <button className="btn btn-primary btn-sm" onClick={() => setPreviewOpen(true)}>快速预览</button>
              <button className="btn btn-primary btn-sm" onClick={() => void post(AnnouncementStatus.DRAFT)}>保存草稿</button>
              <button className="btn btn-primary btn-sm" onClick={() => void post(AnnouncementStatus.ACTIVE)}>发布公告</button>
              <button className="btn btn-danger btn-sm" onClick={() => void post(AnnouncementStatus.EXPIRED)}>设为过期</button>
            </div>
          </div>
        </>
      )}

      <BModal
        className="announcement-detail-dialog"
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        scrollable
      >
        <div
          className="announcement-content"
          aria-label={previewTitle}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(previewContent) as string) }}
        />
      </BModal>
    </div>
  );
}
