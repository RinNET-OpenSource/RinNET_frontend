export interface ChusanCharacter {
  id: number;
  name: string;
  releaseTag: string;
  worksName: string;
  illustratorName: string;
  addImages: string;
}

export interface ChuniV2Character {
  characterId: number;
  playCount: number;
  level: number;
  friendshipExp: number;
  isValid: boolean;
  isNewMark: boolean;
  exMaxLv: number;
  assignIllust: number;
  param1: string;
  param2: string;
  characterInfo: ChusanCharacter;
}

export const CHUNI_V2_CHARACTER_RELEASES = [
  ['v1 1.00.00', 'ORIGIN'],
  ['v1 1.05.00', 'ORIGIN PLUS'],
  ['v1 1.10.00', 'AIR'],
  ['v1 1.15.00', 'AIR PLUS'],
  ['v1 1.20.00', 'STAR'],
  ['v1 1.25.00', 'STAR PLUS'],
  ['v1 1.30.00', 'AMAZON'],
  ['v1 1.35.00', 'AMAZON PLUS'],
  ['v1 1.40.00', 'CRYSTAL'],
  ['v1 1.45.00', 'CRYSTAL PLUS'],
  ['v1 1.50.00', 'PARADISE'],
  ['v1 1.55.00', 'PARADISE LOST'],
  ['v2 2.00.00', 'NEW'],
  ['v2 2.05.00', 'NEW PLUS'],
  ['v2 2.10.00', 'SUN'],
  ['v2 2.15.00', 'SUN PLUS'],
  ['v2 2.20.00', 'LUMINOUS'],
  ['v2 2.25.00', 'LUMINOUS PLUS'],
  ['v2 2.30.00', 'VERSE'],
] as const;

const RELEASE_NAMES = new Map<string, string>(CHUNI_V2_CHARACTER_RELEASES);

export function chuniV2ReleaseName(releaseTag: string): string {
  return RELEASE_NAMES.get(releaseTag) ?? releaseTag;
}

export interface ChuniV2AdditionalCharacterImage {
  id: number;
  name: string;
}

export function parseAdditionalCharacterImages(
  value: string,
): ChuniV2AdditionalCharacterImage[] {
  return value
    .split(',')
    .map((entry) => {
      const [id, name] = entry.split(':');
      return { id: Number(id), name };
    })
    .filter((entry) => entry.id !== -1);
}
