import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import type { Page } from '@/lib/models';
import type { Maimai2Photo } from './models';
import { Maimai2Pagination } from './Maimai2Pagination';
import './Maimai2PhotosPage.css';

const PAGE_SIZE = 10;

/** Equivalent to the legacy maimai2-photos component. */
export function Maimai2PhotosPage() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [photos, setPhotos] = useState<Maimai2Photo[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (page: number) => {
    try {
      await loadUser();
      const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
      const data = (await api.get('api/game/maimai2/recentPhoto', {
        aimeId,
        page: page - 1,
      })) as Page<Maimai2Photo>;
      setPhotos(data.content ?? []);
      setTotalElements(data.totalElements ?? 0);
      setCurrentPage(page);
    } catch (error) {
      notice(String(error));
      setPhotos([]);
      setTotalElements(0);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <>
      <h1 className="page-heading">{t('Maimai2.PhotosPage.Title')}</h1>

      <Maimai2Pagination
        current={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={totalElements}
        onPageChange={(page) => void load(page)}
      />

      {loaded && photos.length === 0 && (
        <div className="alert alert-info">{t('Maimai2.PhotosPage.NotOwned')}</div>
      )}

      <div className="container">
        <div className="row mb-4 g-2">
          {photos.map((item) => (
            <div className="col-12 col-xl-6" key={`${item.playlogId}-${item.trackNo}`}>
              <div className="card">
                <img src={item.fileName} className="card-img-top" alt="右键して遊戏の写真を保存する" />
                <div className="card-footer">
                  <div className="d-flex justify-content-between">
                    <div>{String(item.uploadDate)}</div>
                    <span className="no-wrap">TRACK {item.trackNo}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
