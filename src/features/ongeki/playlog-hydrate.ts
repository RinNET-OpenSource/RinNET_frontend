import { dbGetByKey } from '@/lib/db/db';
import type { OngekiCard, OngekiCharacter, OngekiMusic, PlayerPlaylog } from './models';

/**
 * 服务端只返回游玩记录本身，曲目与卡面资料保存在浏览器 IndexedDB 中，
 * 补齐后 OngekiRecentItem 才能显示曲名、封面与角色卡。
 */
export async function hydratePlaylog(playLog: PlayerPlaylog): Promise<PlayerPlaylog> {
  // 旧接口把新纪录标记写成不带 is 前缀的字段名。
  const legacy = playLog as unknown as Record<string, boolean | undefined>;
  playLog.isTechNewRecord = legacy.techNewRecord || playLog.isTechNewRecord;
  playLog.isBattleNewRecord = legacy.battleNewRecord || playLog.isBattleNewRecord;
  playLog.isOverDamageNewRecord = legacy.overDamageNewRecord || playLog.isOverDamageNewRecord;
  playLog.isFullCombo = legacy.fullCombo || playLog.isFullCombo;
  playLog.isAllBreak = legacy.allBreak || playLog.isAllBreak;
  playLog.isFullBell = legacy.fullBell || playLog.isFullBell;

  const music = await dbGetByKey<OngekiMusic>('ongekiMusic', playLog.musicId);
  if (music) {
    playLog.songInfo = music;
    const bossCard = await dbGetByKey<OngekiCard>('ongekiCard', music.bossCardId);
    if (bossCard) playLog.bossCardInfo = bossCard;
  }
  const chara = await dbGetByKey<OngekiCharacter>('ongekiCharacter', playLog.bossCharaId);
  if (chara) playLog.bossCharaInfo = chara;
  playLog.cardInfo1 = (await dbGetByKey<OngekiCard>('ongekiCard', playLog.cardId1)) ?? undefined;
  playLog.cardInfo2 = (await dbGetByKey<OngekiCard>('ongekiCard', playLog.cardId2)) ?? undefined;
  playLog.cardInfo3 = (await dbGetByKey<OngekiCard>('ongekiCard', playLog.cardId3)) ?? undefined;
  return playLog;
}

export async function hydratePlaylogs(playLogs: PlayerPlaylog[]): Promise<PlayerPlaylog[]> {
  for (const playLog of playLogs) {
    await hydratePlaylog(playLog);
  }
  return playLogs;
}
