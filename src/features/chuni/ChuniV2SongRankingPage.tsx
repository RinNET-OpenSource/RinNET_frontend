import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { dbGetByKey } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { useStore } from '@/lib/store';
import { ChuniV2SongScoreRanking } from './ChuniV2SongScoreRanking';
import type { ChuniV2Song } from './song-models';

/** Makes legacy ranking deep links usable while preserving the score offcanvas UI. */
export function ChuniV2SongRankingPage() {
  const navigate = useNavigate();
  const { id, level } = useParams();
  const catalogStates = useStore(preloadStates);
  const [music, setMusic] = useState<ChuniV2Song | null>(null);
  const musicId = Number(id);
  const requestedLevel = Number(level);

  useEffect(() => {
    if (catalogStates.chusanMusic !== 'OK' || !Number.isFinite(musicId)) return;
    let active = true;
    void dbGetByKey<ChuniV2Song>('chusanMusic', musicId)
      .then((item) => {
        if (!active) return;
        if (item) setMusic(item);
        else navigate('/chuni/v2/song', { replace: true });
      })
      .catch((error) => active && notice(String(error)));
    return () => {
      active = false;
    };
  }, [catalogStates.chusanMusic, musicId, navigate]);

  return (
    <ChuniV2SongScoreRanking
      music={music}
      open={music !== null}
      initialLevel={Number.isFinite(requestedLevel) ? requestedLevel : undefined}
      onClose={() => navigate('/chuni/v2/song')}
    />
  );
}
