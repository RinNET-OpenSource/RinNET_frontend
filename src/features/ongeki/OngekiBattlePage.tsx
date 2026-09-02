import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ongeki-common.css';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { dbGetByKey } from '@/lib/db/db';
import { getCurrentUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import { padDigits } from '@/lib/format';
import type { DisplayOngekiProfile, OngekiCard, OngekiMusic, PlayerRatingItem } from './models';

/** 等价旧版 ongeki-battle-point.component */
export function OngekiBattlePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<DisplayOngekiProfile | null>(null);
  const [bpList, setBpList] = useState<PlayerRatingItem[]>([]);

  useEffect(() => {
    const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
    void api
      .get('api/game/ongeki/profile', { aimeId })
      .then((data) => setProfile(data as DisplayOngekiProfile))
      .catch((error) => notice(String(error)));

    void api
      .get('api/game/ongeki/general', { aimeId, key: 'battle_point_base' })
      .then(async (data) => {
        const propertyValue = data?.propertyValue as string;
        if (!propertyValue || propertyValue.indexOf(',') < 0) {
          notice("Can't read battle data. Please save again in-game");
          return;
        }
        const records = propertyValue.split(',');
        const list: PlayerRatingItem[] = [];
        for (const record of records) {
          const value = record.split(':');
          const item: PlayerRatingItem = {
            musicId: Number(value[0]),
            level: Number(value[1]),
            value: Number(value[2]),
            platinumScoreMax: Number(value[3]),
            platinumScoreStar: Number(value[4]),
          };
          const musicInfo = await dbGetByKey<OngekiMusic>('ongekiMusic', item.musicId);
          if (musicInfo) {
            item.musicInfo = musicInfo;
            const bossCardInfo = await dbGetByKey<OngekiCard>('ongekiCard', musicInfo.bossCardId);
            if (bossCardInfo) item.bossCardInfo = bossCardInfo;
          }
          list.push(item);
        }
        setBpList(list);
      });
  }, []);

  const attrClass = (attr?: string) =>
    attr === 'Aqua' ? 'attr-aqua' : attr === 'Leaf' ? 'attr-leaf' : attr === 'Fire' ? 'attr-fire' : '';

  const levelName = (level: number) =>
    level === 0
      ? 'Basic'
      : level === 1
        ? 'Advanced'
        : level === 2
          ? 'Expert'
          : level === 3
            ? 'Master'
            : level === 10
              ? 'Lunatic'
              : '';

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.BattlePointPage.Title')}</h1>
      <div className="alert alert-info">
        {t('Ongeki.BattlePointPage.TipLead')}
        <ul className="m-0 mt-2">
          <li>{t('Ongeki.BattlePointPage.Tip1')}</li>
          <li>{t('Ongeki.BattlePointPage.Tip2')}</li>
        </ul>
      </div>

      {profile && (
        <div className="card mb-4">
          <div className="card-body">
            {t('Ongeki.BattlePointPage.BattlePoint')}
            {t('Common.Colon')}
            {profile.battlePoint}
          </div>
        </div>
      )}

      <div className="mb-3 d-flex align-items-center">
        <h2 className="mb-0">{t('Ongeki.BattlePointPage.BestBattleScore')}</h2>
      </div>

      <div className="row mb-4 g-2">
        {bpList.map((item, index) => (
          <div className="col-12 col-md-6 col-xxl-4" key={`${item.musicId}-${item.level}-${index}`}>
            <div className="card rating-card">
              <div className="hstack">
                {enableImages && (
                  <img
                    className="jacket rounded-start"
                    src={assetsHost + `assets/ongeki/jacket/UI_Jacket_${padDigits(item.musicId, 4)}_S.webp`}
                    alt=""
                  />
                )}
                {item.musicId !== 0 && (
                  <div className="card-body overflow-hidden py-0 px-2">
                    <div className="text-truncate fw-bold m-0">
                      <span>#{index + 1}</span> {item.musicInfo ? item.musicInfo.name : `MusicID:${item.musicId}`}
                    </div>
                    <div className="text-truncate">{item.value}</div>
                    {item.musicInfo && (
                      <div className="text-truncate small d-flex gap-1 align-items-center">
                        {item.bossCardInfo && (
                          <span className={attrClass(item.bossCardInfo.attribute) + ' badge rounded-pill'}>
                            Lv. {item.musicInfo.bossLevel ?? 'None'}
                          </span>
                        )}
                        <span className="small">{levelName(item.level)}</span>
                      </div>
                    )}
                  </div>
                )}
                {item.musicId === 0 && (
                  <div className="card-body overflow-hidden py-0 px-4 text-truncate">No Record</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
