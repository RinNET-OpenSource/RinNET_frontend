import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ArrowRepeat } from 'react-bootstrap-icons';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { api } from '@/lib/api/client';
import { dbGetAll } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { characterImage } from '@/lib/format';
import { notice } from '@/lib/message';
import { useStore } from '@/lib/store';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost } from '@/lib/utils';
import { ChuniV2Pagination } from './ChuniV2Pagination';
import {
  CHUNI_V2_CHARACTER_RELEASES,
  chuniV2ReleaseName,
  parseAdditionalCharacterImages,
  type ChuniV2Character,
  type ChusanCharacter,
} from './character-models';
import './ChuniV2CharacterPage.css';

const PAGE_SIZE = 12;
const FALLBACK_CHARACTER_IMAGE =
  `${assetsHost}assets/chuni/chara/CHU_UI_Character_0000_00_00.webp`;

interface ChuniV2CharacterProfileSelection {
  characterId: number;
  charaIllustId: number;
}

function parseSearchTerms(searchTerm: string): string[] {
  const terms: string[] = [];
  let buffer = '';
  let inQuotes = false;
  let escapeNext = false;

  for (const character of searchTerm) {
    if (escapeNext) {
      buffer += character;
      escapeNext = false;
    } else if (character === '\\') {
      escapeNext = true;
    } else if (character === '"') {
      if (!inQuotes && buffer.length > 0) {
        terms.push(buffer.trim());
        buffer = '';
      }
      inQuotes = !inQuotes;
    } else if (character === ' ' && !inQuotes) {
      if (buffer.length > 0) {
        terms.push(buffer);
        buffer = '';
      }
    } else {
      buffer += character;
    }
  }

  if (buffer.length > 0) terms.push(buffer.trim());
  return terms;
}

function characterMatchesTerms(character: ChusanCharacter, terms: string[]): boolean {
  const additionalImages = parseAdditionalCharacterImages(character.addImages);
  const name = character.name.toLowerCase();
  const illustratorName = character.illustratorName.toLowerCase();
  const worksName = character.worksName.toLowerCase();

  return terms.every((term) => {
    if (
      character.id === Number(term) ||
      additionalImages.some((additional) => additional.id === Number(term))
    ) {
      return true;
    }
    if (
      name.includes(term) ||
      additionalImages.some((additional) => additional.name?.includes(term))
    ) {
      return true;
    }
    return illustratorName.includes(term) || worksName.includes(term);
  });
}

function displayedCharacterName(character: ChuniV2Character): string {
  const allImages = [
    { id: character.characterInfo.id, name: character.characterInfo.name },
    ...parseAdditionalCharacterImages(character.characterInfo.addImages),
  ];
  return allImages.find((entry) => entry.id === character.characterId)?.name
    ?? character.characterInfo.name;
}

function emptyCharacter(characterId: number, characterInfo: ChusanCharacter): ChuniV2Character {
  return {
    characterId,
    playCount: 0,
    level: 0,
    friendshipExp: 0,
    isValid: false,
    isNewMark: false,
    exMaxLv: 0,
    assignIllust: 0,
    param1: '0',
    param2: '0',
    characterInfo,
  };
}

function CharacterDetailsModal({
  character,
  equippedIllustrationId,
  onClose,
  onSet,
  onUnlock,
}: {
  character: ChuniV2Character | null;
  equippedIllustrationId: number;
  onClose: () => void;
  onSet: (character: ChuniV2Character) => void;
  onUnlock: (character: ChuniV2Character) => void;
}) {
  const { t } = useTranslation();

  return (
    <DialogPrimitive.Root
      open={character !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="chuni-v2-character-dialog-overlay modal-backdrop fade show" />
        <DialogPrimitive.Content
          className="chuni-v2-character-dialog d-block modal fade show"
          aria-describedby={undefined}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <DialogPrimitive.Title asChild>
                  <h4 className="modal-title">{t('ChuniV2.CharacterPage.Details')}</h4>
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <button type="button" className="btn-close shadow-none" aria-label="Close" />
                </DialogPrimitive.Close>
              </div>
              {character && (
                <div className="modal-body">
                  <table className="card-details-table table table-borderless table-sm table-striped align-middle text-center small">
                    <tbody>
                      <tr>
                        <td>ID</td>
                        <td>{character.characterId}</td>
                      </tr>
                      {character.isValid && (
                        <>
                          <tr>
                            <td>{t('ChuniV2.CharacterPage.Rank')}</td>
                            <td>{character.level}</td>
                          </tr>
                          <tr>
                            <td>{t('ChuniV2.CharacterPage.PlayCount')}</td>
                            <td>{character.playCount}</td>
                          </tr>
                        </>
                      )}
                      <tr>
                        <td>{t('ChuniV2.CharacterPage.Name')}</td>
                        <td>{displayedCharacterName(character)}</td>
                      </tr>
                      <tr>
                        <td>{t('ChuniV2.CharacterPage.WorksName')}</td>
                        <td>{character.characterInfo.worksName}</td>
                      </tr>
                      {character.characterInfo.illustratorName && (
                        <tr>
                          <td>{t('ChuniV2.CharacterPage.Illustrator')}</td>
                          <td>{character.characterInfo.illustratorName}</td>
                        </tr>
                      )}
                      <tr>
                        <td>{t('ChuniV2.CharacterPage.Version')}</td>
                        <td>{chuniV2ReleaseName(character.characterInfo.releaseTag)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="hstack gap-1 float-end">
                    {character.isValid ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={character.characterId === equippedIllustrationId}
                        onClick={() => onSet(character)}
                      >
                        {t('ChuniV2.CharacterPage.Set')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        onClick={() => onUnlock(character)}
                      >
                        {t('ChuniV2.CharacterPage.Unlock')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Equivalent to the legacy Chunithm v2 character component. */
export function ChuniV2CharacterPage() {
  const { t } = useTranslation();
  const catalogStates = useStore(preloadStates);
  const [searchParams, setSearchParams] = useSearchParams();
  const [aimeId, setAimeId] = useState('');
  const [catalog, setCatalog] = useState<ChusanCharacter[]>([]);
  const [acquiredIds, setAcquiredIds] = useState<number[]>([]);
  const [filterAcquiredIds, setFilterAcquiredIds] = useState<number[]>([]);
  const [equippedCharacterId, setEquippedCharacterId] = useState(0);
  const [equippedIllustrationId, setEquippedIllustrationId] = useState(0);
  const [showAcquired, setShowAcquired] = useState(true);
  const [showUnacquired, setShowUnacquired] = useState(false);
  const [releaseChecked, setReleaseChecked] = useState<boolean[]>(
    CHUNI_V2_CHARACTER_RELEASES.map(() => false),
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [characters, setCharacters] = useState<ChuniV2Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const loadSequence = useRef(0);

  const catalogReady = catalogStates.chusanCharacter === 'OK';

  useEffect(() => {
    if (!catalogReady) return;
    let active = true;
    void (async () => {
      try {
        await loadUser();
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        const [allCharacters, profile, ids] = await Promise.all([
          dbGetAll<ChusanCharacter>('chusanCharacter'),
          api.get('api/game/chuni/v2/profile', { aimeId: id }) as Promise<ChuniV2CharacterProfileSelection>,
          api.get('api/game/chuni/v2/charaIds', { aimeId: id }) as Promise<number[]>,
        ]);
        if (!active) return;
        setAimeId(id);
        setCatalog(allCharacters);
        setEquippedCharacterId(profile.characterId);
        setEquippedIllustrationId(profile.charaIllustId);
        setAcquiredIds(ids);
        setFilterAcquiredIds(ids);
        setPrepared(true);
      } catch (error) {
        if (active) notice(String(error));
      }
    })();
    return () => {
      active = false;
    };
  }, [catalogReady]);

  const filteredIds = useMemo(() => {
    let ids: number[];
    if (showAcquired === showUnacquired) {
      ids = catalog.map((character) => character.id);
    } else if (showAcquired) {
      ids = [...filterAcquiredIds];
    } else {
      const acquired = new Set(filterAcquiredIds);
      ids = catalog.map((character) => character.id).filter((id) => !acquired.has(id));
    }

    const selectedReleases = CHUNI_V2_CHARACTER_RELEASES
      .filter((_, index) => releaseChecked[index])
      .map(([releaseTag]) => releaseTag);
    if (
      selectedReleases.length > 0 &&
      selectedReleases.length !== CHUNI_V2_CHARACTER_RELEASES.length
    ) {
      const matchingIds = new Set(
        catalog
          .filter((character) => selectedReleases.includes(character.releaseTag as never))
          .map((character) => character.id),
      );
      ids = ids.filter((id) => matchingIds.has(id));
    }

    const byId = new Map(catalog.map((character) => [character.id, character]));
    const terms = parseSearchTerms(searchTerm.toLowerCase());
    return ids.filter((id) => {
      const character = byId.get(id);
      return character ? characterMatchesTerms(character, terms) : false;
    });
  }, [catalog, filterAcquiredIds, releaseChecked, searchTerm, showAcquired, showUnacquired]);

  const totalPages = Math.max(1, Math.ceil(filteredIds.length / PAGE_SIZE));

  useEffect(() => {
    if (!prepared) return;
    const requestedPage = Number(searchParams.get('page'));
    if (searchParams.has('page') && Number.isFinite(requestedPage) && requestedPage > 0) {
      setCurrentPage(Math.floor(requestedPage));
      return;
    }
    const equippedIndex = filteredIds.indexOf(equippedCharacterId);
    if (equippedIndex >= 0) setCurrentPage(Math.floor(equippedIndex / PAGE_SIZE) + 1);
  }, [equippedCharacterId, filteredIds, prepared, searchParams]);

  useEffect(() => {
    if (!prepared || currentPage <= totalPages) return;
    setCurrentPage(totalPages);
    setSearchParams({ page: String(totalPages) }, { replace: true });
  }, [currentPage, prepared, setSearchParams, totalPages]);

  useEffect(() => {
    if (!prepared || currentPage > totalPages) return;
    const sequence = ++loadSequence.current;
    const start = Math.min((currentPage - 1) * PAGE_SIZE, filteredIds.length);
    const pageIds = filteredIds.slice(start, Math.min(start + PAGE_SIZE, filteredIds.length));
    const acquired = new Set(acquiredIds);
    const acquiredPageIds = pageIds.filter((id) => acquired.has(id));

    void api
      .get('api/game/chuni/v2/charaInfos', {
        charaIds: acquiredPageIds.join(','),
        aimeId,
      })
      .then((response) => {
        if (sequence !== loadSequence.current) return;
        const received = response as Omit<ChuniV2Character, 'characterInfo'>[];
        const receivedById = new Map(received.map((character) => [character.characterId, character]));
        const infoById = new Map(catalog.map((character) => [character.id, character]));
        const rows = pageIds.flatMap((id) => {
          const characterInfo = infoById.get(id);
          if (!characterInfo) return [];
          const character = receivedById.get(id);
          return [
            character
              ? { ...character, characterInfo }
              : emptyCharacter(id, characterInfo),
          ];
        });
        setCharacters(rows);
        setLoadedOnce(true);
      })
      .catch((error) => {
        if (sequence === loadSequence.current) notice(String(error));
      });
  }, [acquiredIds, aimeId, catalog, currentPage, filteredIds, prepared, totalPages]);

  const selectedCharacter = selectedCharacterId === null
    ? null
    : characters.find((character) => character.characterInfo.id === selectedCharacterId) ?? null;
  const defaultFilter =
    showAcquired &&
    !showUnacquired &&
    releaseChecked.every((value) => !value) &&
    searchTerm === '';

  function changePage(page: number) {
    setCurrentPage(page);
    setSearchParams({ page: String(page) });
  }

  function resetFilter() {
    setFilterAcquiredIds(acquiredIds);
    setShowAcquired(true);
    setShowUnacquired(false);
    setReleaseChecked(CHUNI_V2_CHARACTER_RELEASES.map(() => false));
    setSearchTerm('');
  }

  function nextImage(event: MouseEvent, character: ChuniV2Character) {
    event.stopPropagation();
    const ids = [
      character.characterInfo.id,
      ...parseAdditionalCharacterImages(character.characterInfo.addImages).map((image) => image.id),
    ];
    if (ids.length <= 1) return;
    const currentIndex = ids.indexOf(character.characterId);
    const nextId = ids[(currentIndex + 1) % ids.length];
    setCharacters((current) =>
      current.map((entry) =>
        entry.characterInfo.id === character.characterInfo.id
          ? { ...entry, characterId: nextId }
          : entry,
      ),
    );
  }

  async function setCharacter(character: ChuniV2Character) {
    try {
      const result = (await api.put('api/game/chuni/v2/profile/character', {
        aimeId,
        characterId: character.characterInfo.id,
        charaIllustId: character.characterId,
      })) as ChuniV2CharacterProfileSelection;
      setEquippedCharacterId(result.characterId);
      setEquippedIllustrationId(result.charaIllustId);
      setSelectedCharacterId(null);
      notice(t('ChuniV2.CharacterPage.SetSuccess'), 'success');
    } catch (error) {
      notice(String(error), 'warning');
    }
  }

  async function unlockCharacter(character: ChuniV2Character) {
    const characterId = character.characterInfo.id;
    try {
      await api.post('api/game/chuni/v2/character', {
        aimeId,
        characterId,
        level: 1,
        isValid: true,
        isNewMark: true,
      });
      setAcquiredIds((current) => [characterId, ...current.filter((id) => id !== characterId)]);
    } catch (error) {
      notice(String(error));
    }
  }

  return (
    <div className="chuni-v2-character-page">
      <h1 className="page-heading">{t('ChuniV2.CharacterPage.Title')}</h1>

      {loadedOnce && (
        <ChuniV2Pagination
          current={currentPage}
          listClassName="pagination pagination-sm justify-content-center mb-2"
          pageSize={PAGE_SIZE}
          totalItems={filteredIds.length}
          onPageChange={changePage}
        />
      )}

      <div className={`collapse${filterOpen ? ' show' : ''}`} id="filterCollapse">
        <div className="row mb-2 g-1">
          <div className="col-12 col-sm-auto pt-1 me-3">
            {t('ChuniV2.CharacterPage.Acquisition')}
          </div>
          <div className="col-12 col-sm">
            <div className="row justify-content-start align-items-center g-1">
              <div className="col-auto">
                <input
                  className="checkbox checkbox-btn"
                  type="checkbox"
                  role="switch"
                  id="showAcquired"
                  value="acquired"
                  checked={showAcquired}
                  onChange={(event) => {
                    setFilterAcquiredIds(acquiredIds);
                    setShowAcquired(event.target.checked);
                  }}
                />
                <label className="checkbox-label" htmlFor="showAcquired">
                  {t('ChuniV2.CharacterPage.Acquired')}
                </label>
              </div>
              <div className="col-auto">
                <input
                  className="checkbox checkbox-btn"
                  type="checkbox"
                  role="switch"
                  id="showUnacquired"
                  value="unacquired"
                  checked={showUnacquired}
                  onChange={(event) => {
                    setFilterAcquiredIds(acquiredIds);
                    setShowUnacquired(event.target.checked);
                  }}
                />
                <label className="checkbox-label" htmlFor="showUnacquired">
                  {t('ChuniV2.CharacterPage.Unacquired')}
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="row mb-2 g-1">
          <div className="col-12 col-sm-auto pt-1 me-3">
            {t('ChuniV2.CharacterPage.Version')}
          </div>
          <div className="col-12 col-sm">
            <div className="row justify-content-start align-items-center g-1">
              {CHUNI_V2_CHARACTER_RELEASES.map(([releaseTag, releaseName], index) => (
                <div className="col-auto" key={releaseTag}>
                  <input
                    type="checkbox"
                    className="form-check-input checkbox-btn"
                    value={releaseTag}
                    id={`releaseTag${index}`}
                    checked={releaseChecked[index]}
                    onChange={(event) => {
                      setFilterAcquiredIds(acquiredIds);
                      setReleaseChecked((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? event.target.checked : value,
                        ),
                      );
                    }}
                  />
                  <label className="checkbox-label" htmlFor={`releaseTag${index}`}>
                    {releaseName}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row mb-2 g-1">
          <div className="col-12 p-0">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder={t('ChuniV2.CharacterPage.SearchPlaceholder')}
              value={searchTerm}
              onChange={(event) => {
                setFilterAcquiredIds(acquiredIds);
                setSearchTerm(event.target.value);
              }}
            />
          </div>
        </div>
      </div>

      {prepared && (
        <div className="mb-2">
          <span>{t('ChuniV2.CharacterPage.TotalCharaNum', { num: filteredIds.length })}</span>
          <a className="link-btn ms-3" onClick={() => setFilterOpen((open) => !open)}>
            {t(
              filterOpen
                ? 'ChuniV2.CharacterPage.HideFilter'
                : 'ChuniV2.CharacterPage.ShowFilter',
            )}
          </a>
          {!defaultFilter && (
            <a className="link-btn ms-3" onClick={resetFilter}>
              {t('ChuniV2.CharacterPage.ResetFilter')}
            </a>
          )}
        </div>
      )}

      <div>
        <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-2 mb-2">
          {characters.map((character) => {
            const additionalImageCount = parseAdditionalCharacterImages(
              character.characterInfo.addImages,
            ).length;
            return (
              <div className="col position-relative" key={character.characterInfo.id}>
                <div
                  className={`card card-btn${
                    character.characterInfo.id === equippedCharacterId ? ' border-primary' : ''
                  }`}
                  onClick={() => setSelectedCharacterId(character.characterInfo.id)}
                >
                  <div
                    className={`card-body character-card${
                      character.isValid ? '' : ' grayscale opacity-50'
                    }`}
                  >
                    <div className="character-title marquee">
                      <div className="marquee-wrap">
                        <div className="marquee-content">
                          {displayedCharacterName(character)}
                        </div>
                      </div>
                    </div>
                    <div className="character-img">
                      <img
                        className="w-100"
                        src={`${assetsHost}assets/chuni/chara/CHU_UI_Character_${characterImage(character.characterId)}_00.webp`}
                        alt=""
                        onError={(event) => {
                          if (event.currentTarget.src !== FALLBACK_CHARACTER_IMAGE) {
                            event.currentTarget.src = FALLBACK_CHARACTER_IMAGE;
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                {additionalImageCount > 0 && (
                  <div className="image-switch" onClick={(event) => nextImage(event, character)}>
                    <div className="badge rounded-pill bg-primary d-flex align-items-center gap-1">
                      +{additionalImageCount}
                      <ArrowRepeat />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loadedOnce && (
        <ChuniV2Pagination
          current={currentPage}
          listClassName="pagination pagination-sm justify-content-center mb-2"
          pageSize={PAGE_SIZE}
          totalItems={filteredIds.length}
          onPageChange={changePage}
        />
      )}

      <CharacterDetailsModal
        character={selectedCharacter}
        equippedIllustrationId={equippedIllustrationId}
        onClose={() => setSelectedCharacterId(null)}
        onSet={(character) => void setCharacter(character)}
        onUnlock={(character) => void unlockCharacter(character)}
      />
    </div>
  );
}
