import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/shared/Pagination';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { dbGetByKey } from '@/lib/db/db';
import type {
  OngekiCard,
  OngekiCharacter,
  OngekiMusic,
  PlayerPlaylog,
} from './models';
import { OngekiRecentItem } from './OngekiRecentItem';

/** 等价旧版 ongeki-recent.component（游玩记录，服务端分页） */
export function OngekiRecentPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const currentPage = Number(searchParams.get('page') ?? 1) || 1;

  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState<PlayerPlaylog[]>([]);
  const [totalElements, setTotalElements] = useState(0);

  useEffect(() => {
    setLoading(true);
    void api
      .get('api/game/ongeki/recent', { page: currentPage - 1 })
      .then(async (data) => {
        setTotalElements(data.totalElements);
        const content: PlayerPlaylog[] = data.content ?? [];
        for (const x of content) {
          x.isTechNewRecord = (x as any).techNewRecord ? (x as any).techNewRecord : x.isTechNewRecord;
          x.isBattleNewRecord = (x as any).battleNewRecord ? (x as any).battleNewRecord : x.isBattleNewRecord;
          x.isOverDamageNewRecord = (x as any).overDamageNewRecord
            ? (x as any).overDamageNewRecord
            : x.isOverDamageNewRecord;
          x.isFullCombo = (x as any).fullCombo ? (x as any).fullCombo : x.isFullCombo;
          x.isAllBreak = (x as any).allBreak ? (x as any).allBreak : x.isAllBreak;
          x.isFullBell = (x as any).fullBell ? (x as any).fullBell : x.isFullBell;

          const music = await dbGetByKey<OngekiMusic>('ongekiMusic', x.musicId);
          if (music) {
            x.songInfo = music;
            const bossCard = await dbGetByKey<OngekiCard>('ongekiCard', music.bossCardId);
            if (bossCard) x.bossCardInfo = bossCard;
          }
          const chara = await dbGetByKey<OngekiCharacter>('ongekiCharacter', x.bossCharaId);
          if (chara) x.bossCharaInfo = chara;
          x.cardInfo1 = (await dbGetByKey<OngekiCard>('ongekiCard', x.cardId1)) ?? undefined;
          x.cardInfo2 = (await dbGetByKey<OngekiCard>('ongekiCard', x.cardId2)) ?? undefined;
          x.cardInfo3 = (await dbGetByKey<OngekiCard>('ongekiCard', x.cardId3)) ?? undefined;
        }
        setRecent(content);
        setLoading(false);
      })
      .catch((error) => {
        notice(String(error));
        setLoading(false);
      });
  }, [currentPage]);

  function pageChanged(page: number) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('page', String(page));
      return p;
    });
    void navigate(`/ongeki/recent?page=${page}`, { replace: false });
  }

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.RecentPage.Title')}</h1>

      <Pagination
        current={currentPage}
        pageSize={10}
        totalItems={totalElements}
        onPageChange={pageChanged}
      />

      <div className="list-group gap-3 my-3">
        {loading && (
          <div className="card placeholder-wave user-select-none" aria-hidden="true">
            <div className="card-header hstack gap-2" style={{ padding: 4 }}>
              <div className="ratio ratio-1x1" style={{ width: 96, minWidth: 96 }}>
                <span className="position-absolute placeholder" />
              </div>
              <div className="overflow-hidden">
                <div className="text-truncate fw-bold">
                  <span className="placeholder" style={{ fontSize: 18, minWidth: 192 }} />
                </div>
                <div className="text-truncate">
                  <span className="placeholder" style={{ fontSize: 12, minWidth: 128 }} />
                </div>
              </div>
            </div>
            <div className="card-body" style={{ paddingBottom: 0 }}>
              <div className="row align-items-center">
                <div className="col-12 col-md-6">
                  <div className="row text-nowrap">
                    <div className="col-6 text-end">
                      <div className="placeholder" style={{ width: 96, height: 60 }} />
                    </div>
                    <div className="col-6 align-items-center d-flex">
                      <span className="placeholder" style={{ height: 64, width: 64, borderRadius: '50%' }} />
                    </div>
                  </div>
                </div>
                <div className="col-12 col-md-6">
                  <span className="placeholder" style={{ height: 96, width: '100%' }} />
                </div>
              </div>
            </div>
            <div className="card-footer bg-transparent text-end fw-bold">
              <span className="placeholder" style={{ width: 175 }} />
            </div>
          </div>
        )}
        {!loading &&
          recent.map((item, i) => (
            <div key={i}>
              <OngekiRecentItem playLog={item} />
            </div>
          ))}
      </div>

      <Pagination
        current={currentPage}
        pageSize={10}
        totalItems={totalElements}
        onPageChange={pageChanged}
      />
      <div className="mb-3" />
    </div>
  );
}
