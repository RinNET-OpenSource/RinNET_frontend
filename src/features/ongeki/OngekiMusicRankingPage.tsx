import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, DashLg } from 'react-bootstrap-icons';
import { api } from '@/lib/api/client';
import { assetsHost, enableImages } from '@/lib/utils';
import { padDigits } from '@/lib/format';
import { OngekiSongScoreRanking } from './OngekiSongScoreRanking';
import type { OngekiGameRanking, OngekiMusic } from './models';
import './ranking.css';

/** 等价旧版 ongeki-music-ranking.component */
export function OngekiMusicRankingPage() {
  const { t } = useTranslation();
  const [rankings, setRankings] = useState<OngekiGameRanking[]>([]);
  const [detailMusic, setDetailMusic] = useState<OngekiMusic | null>(null);

  useEffect(() => {
    void api.get('api/game/ongeki/data/musicRanking').then((data) => setRankings(data ?? []));
  }, []);

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.MusicRankingPage.Title')}</h1>

      <table className="table table-hover">
        <colgroup>
          <col style={{ width: '2rem' }} />
          <col style={{ width: 'auto' }} />
          <col style={{ width: 'min-content' }} />
        </colgroup>
        <tbody>
          {rankings.map((item, i) => (
            <tr
              className="ranking-row"
              key={i}
              onClick={() => item.music && setDetailMusic(item.music)}
            >
              <th className="text-end" scope="row">
                {i === 0 && <img className="medal" src={assetsHost + 'assets/gold-medal.svg'} alt="" />}
                {i === 1 && <img className="medal" src={assetsHost + 'assets/silver-medal.svg'} alt="" />}
                {i === 2 && <img className="medal" src={assetsHost + 'assets/bronze-medal.svg'} alt="" />}
                {i > 2 && <span className="ranking-text">{item.ranking}.</span>}
              </th>
              <td>
                <div className="row align-items-center g-2">
                  <div className="col-auto">
                    {enableImages && (
                      <img
                        className={
                          'ranking-item-icon' +
                          (i === 0 ? ' ranking-item-icon-xl' : i === 1 || i === 2 ? ' ranking-item-icon-lg' : '')
                        }
                        src={
                          assetsHost +
                          `assets/ongeki/jacket/UI_Jacket_${padDigits(item.music?.id ?? 0, 4)}.webp`
                        }
                        alt=""
                      />
                    )}
                  </div>
                  <div className={'col text-truncate' + (i <= 2 ? ' fw-bold' : '')}>
                    {item.music?.name ?? '？？？'}
                  </div>
                </div>
              </td>
              <td className="text-nowrap text-end">
                <div className="d-flex align-items-center justify-content-end gap-2">
                  {item.playCount}
                  {item.state === 1 && <ChevronUp style={{ color: 'deepskyblue' }} />}
                  {item.state === -1 && <ChevronDown style={{ color: 'red' }} />}
                  {item.state === 0 && <DashLg />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <OngekiSongScoreRanking
        music={detailMusic}
        open={!!detailMusic}
        onClose={() => setDetailMusic(null)}
      />
    </div>
  );
}
