import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SHA256, enc } from 'crypto-js';
import {
  ExclamationTriangleFill,
  InfoCircleFill,
  Eye,
  EyeSlash,
  Clipboard,
  PlusSquareDotted,
} from 'react-bootstrap-icons';
import { BModal } from '@/components/shared/BModal';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { StatusCode } from '@/lib/models';
import './KeychipPage.css';

const GAME_VERSION_PATTERN = /^[0-9]+\.[0-9]{2}\.[0-9]{2}$/;
const KEYCHIP_ID_PATTERN = /^A39E-01[A-Z][0-9]{8}$/;

/** 等价旧版 KeychipId（SHA256 → 4 位 ext 校验值） */
export class KeychipId {
  shortValue: string;
  extValue: string;

  constructor(shortValue: string) {
    this.shortValue = shortValue;
    this.extValue = genExtValue(shortValue);
  }

  get fullValue(): string {
    return this.shortValue.substring(0, 4) + '-' + this.shortValue.substring(4, 11) + this.extValue;
  }
}

interface UiKeychip {
  id: number;
  keychipId: KeychipId;
  placeName: string;
  whiteListed: boolean;
  user: { id: number; name: string };
  gameVersions?: KeychipGameVersion[];
}

type GameVersionSource = 'MANUAL' | 'OBSERVED' | 'DEFAULT';

interface GameVersionPair {
  romVersion: string;
  dataVersion: string;
}

interface NullableGameVersionPair {
  romVersion: string | null;
  dataVersion: string | null;
}

interface KeychipGameVersion {
  game: 'CHUSAN' | 'ONGEKI';
  observed: NullableGameVersionPair;
  manual: NullableGameVersionPair;
  effective: GameVersionPair;
  source: { romVersion: GameVersionSource; dataVersion: GameVersionSource };
}

function genExtValue(shortValue: string): string {
  const hashOutput = SHA256(shortValue);
  const hashHex = hashOutput.toString(enc.Hex);
  const hashBigInt = BigInt('0x' + hashHex);
  const modResult = hashBigInt % BigInt(10000);
  return modResult.toString().padStart(4, '0');
}

function checkKeychipIdValid(value: string): boolean {
  if (!KEYCHIP_ID_PATTERN.test(value)) return false;
  const shortValue = value.substring(0, 4) + value.substring(5, 12);
  return value.substring(12) === genExtValue(shortValue);
}

function displayValue(shortValue: string, extValue: string, hidden: boolean): string {
  if (hidden) {
    return shortValue.substring(0, 4) + '-' + shortValue.substring(4, 6) + '*********';
  }
  return shortValue.substring(0, 4) + '-' + shortValue.substring(4, 11) + extValue;
}

/** 等价旧版 keychip.component */
export function KeychipPage() {
  const { t } = useTranslation();
  const [keychips, setKeychips] = useState<UiKeychip[]>([]);
  const [keychipLoaded, setKeychipLoaded] = useState(false);
  const [trustKeychips, setTrustKeychips] = useState<UiKeychip[]>([]);
  const [trustKeychipLoaded, setTrustKeychipLoaded] = useState(false);
  const [hiddenMap, setHiddenMap] = useState<Record<string, boolean>>({});

  const [trustIdInput, setTrustIdInput] = useState('');
  const [trustModalOpen, setTrustModalOpen] = useState(false);
  const [renaming, setRenaming] = useState<UiKeychip | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [removing, setRemoving] = useState<UiKeychip | null>(null);
  const [untrusting, setUntrusting] = useState<UiKeychip | null>(null);

  const [editor, setEditor] = useState<{ keychip: UiKeychip; version: KeychipGameVersion } | null>(null);
  const [romVersion, setRomVersion] = useState('');
  const [dataVersion, setDataVersion] = useState('');
  const [versionTouched, setVersionTouched] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [restoreConfirmationPending, setRestoreConfirmationPending] = useState(false);

  function mapKeychip(keychip: any): UiKeychip {
    return { ...keychip, keychipId: new KeychipId(keychip.keychipId) };
  }

  useEffect(() => {
    void api
      .get('api/user/keychip')
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK && resp.data) {
            setKeychips(resp.data.map(mapKeychip));
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Load keychips failed.');
        }
        setKeychipLoaded(true);
      })
      .catch((error) => notice(String(error)));

    void api
      .get('api/user/keychip/trustKeychip')
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK && resp.data) {
            setTrustKeychips(resp.data.map((d: any) => mapKeychip(d.keychip)));
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Load keychips failed.');
        }
        setTrustKeychipLoaded(true);
      })
      .catch((error) => notice(String(error)));
  }, []);

  function genKeychip() {
    void api
      .post('api/user/genKeychip')
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK) {
            setKeychips((list) => [...list, mapKeychip(resp.data)]);
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Gen keychip failed.');
        }
      })
      .catch((error) => notice(String(error)));
  }

  function onTrustKeychipSubmit() {
    if (!checkKeychipIdValid(trustIdInput)) return;
    const keychipId = trustIdInput.substring(0, 4) + trustIdInput.substring(5, 12);
    void api
      .post('api/user/keychip/trustKeychip', { keychipId })
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK) {
            setTrustKeychips((list) => [...list, mapKeychip(resp.data.keychip)]);
            setTrustIdInput('');
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Trust keychip failed.');
        }
      })
      .catch((error) => notice(String(error)));
    setTrustModalOpen(false);
  }

  function onRenameSubmit() {
    if (!renaming || !renameInput || renameInput.length > 20) return;
    const body = { keychipId: renaming.keychipId.shortValue, placeName: renameInput };
    void api
      .post('api/user/modifyKeychip', body)
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK) {
            setKeychips((list) =>
              list.map((k) => (k.id === renaming.id ? { ...k, placeName: renameInput } : k)),
            );
            notice('Modify place name success.', 'success');
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Modify place name failed.', 'danger');
        }
      })
      .catch((error) => notice(String(error)));
    setRenaming(null);
  }

  function onRemoveKeychip(keychip: UiKeychip) {
    void api
      .delete('api/user/keychip/' + keychip.id)
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK) {
            setKeychips((list) => list.filter((k) => k !== keychip));
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Remove keychip failed.');
        }
      })
      .catch((error) => notice(String(error)));
    setRemoving(null);
  }

  function onUntrustKeychip(keychip: UiKeychip) {
    const body = { keychipId: keychip.keychipId.shortValue };
    void api
      .delete('api/user/keychip/trustKeychip', undefined, body)
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK) {
            setTrustKeychips((list) => list.filter((k) => k !== keychip));
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Untrust keychip failed.');
        }
      })
      .catch((error) => notice(String(error)));
    setUntrusting(null);
  }

  function openGameVersionEditor(keychip: UiKeychip, version: KeychipGameVersion) {
    const pair =
      version.manual.romVersion !== null && version.manual.dataVersion !== null
        ? version.manual
        : version.effective;
    const safePair = pair as GameVersionPair;
    setRomVersion(safePair.romVersion);
    setDataVersion(safePair.dataVersion);
    setVersionTouched(false);
    setRestoreConfirmationPending(false);
    setEditor({ keychip, version });
  }

  function gameVersionPath(ed: { keychip: UiKeychip; version: KeychipGameVersion }): string {
    const keychipId = encodeURIComponent(ed.keychip.keychipId.shortValue);
    return `api/user/keychip/${keychipId}/game-version/${ed.version.game.toUpperCase()}`;
  }

  function saveGameVersion() {
    if (!editor || mutationPending) return;
    if (!GAME_VERSION_PATTERN.test(romVersion) || !GAME_VERSION_PATTERN.test(dataVersion)) {
      setVersionTouched(true);
      return;
    }
    setMutationPending(true);
    void api
      .put(gameVersionPath(editor), { romVersion, dataVersion })
      .then((resp) => handleMutationResponse(resp, 'KeychipPage.GameVersions.SaveSuccess', 'KeychipPage.GameVersions.SaveFailed'))
      .catch(() => handleMutationError('KeychipPage.GameVersions.SaveFailed'));
  }

  function requestClearGameVersion() {
    if (mutationPending) return;
    if (!restoreConfirmationPending) {
      setRestoreConfirmationPending(true);
      return;
    }
    setMutationPending(true);
    void api
      .delete(gameVersionPath(editor!))
      .then((resp) => handleMutationResponse(resp, 'KeychipPage.GameVersions.RestoreSuccess', 'KeychipPage.GameVersions.RestoreFailed'))
      .catch(() => handleMutationError('KeychipPage.GameVersions.RestoreFailed'));
  }

  function handleMutationResponse(resp: any, successKey: string, failureKey: string) {
    setMutationPending(false);
    const ed = editor;
    if (
      ed &&
      resp?.status?.code === StatusCode.OK &&
      resp.data &&
      resp.data.game === ed.version.game &&
      GAME_VERSION_PATTERN.test(resp.data.effective?.romVersion ?? '')
    ) {
      setKeychips((list) =>
        list.map((k) => {
          if (k !== ed.keychip || !k.gameVersions) return k;
          return {
            ...k,
            gameVersions: k.gameVersions.map((v) => (v.game === resp.data.game ? resp.data : v)),
          };
        }),
      );
      notice(t(successKey), 'success');
      setEditor(null);
      return;
    }
    notice(t(failureKey), 'danger');
  }

  function handleMutationError(failureKey: string) {
    setMutationPending(false);
    notice(t(failureKey), 'danger');
  }

  function copyKeychip(keychip: UiKeychip) {
    const ok = () => notice('Value has been copied.', 'success');
    const fail = () => notice('Copying failed.', 'danger');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(keychip.keychipId.fullValue).then(ok, fail);
    } else {
      fail();
    }
  }

  const idDisplay = (keychip: UiKeychip) =>
    displayValue(keychip.keychipId.shortValue, keychip.keychipId.extValue, hiddenMap[keychip.id] ?? true);
  const toggleHidden = (keychip: UiKeychip) =>
    setHiddenMap((s) => ({ ...s, [keychip.id]: !(s[keychip.id] ?? true) }));

  const eyeControls = (keychip: UiKeychip) => (
    <>
      <div className="ms-2 p-0 user-select-none cursor-pointer d-flex align-items-center" onClick={() => toggleHidden(keychip)}>
        {hiddenMap[keychip.id] ?? true ? <Eye /> : <EyeSlash />}
      </div>
      <div className="ms-2 p-0 user-select-none cursor-pointer d-flex align-items-center" onClick={() => copyKeychip(keychip)}>
        <Clipboard />
      </div>
    </>
  );

  const gameVersionPanel = (keychip: UiKeychip, version: KeychipGameVersion) => (
    <article className="game-version-panel" key={version.game}>
      <div className="game-version-heading">
        <strong>{t('KeychipPage.GameVersions.' + version.game)}</strong>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary game-version-edit"
          onClick={() => openGameVersionEditor(keychip, version)}
        >
          {t('KeychipPage.GameVersions.Edit')}
        </button>
      </div>
      <div className="game-version-effective-label game-version-label">
        {t('KeychipPage.GameVersions.Effective')}
      </div>
      <div className="game-version-values">
        <div className="game-version-row">
          <span className="game-version-label">{t('KeychipPage.GameVersions.ROM')}</span>
          <span className="game-version-value font-monospace">{version.effective.romVersion}</span>
          {version.source.romVersion !== version.source.dataVersion && (
            <span className="game-version-source-per-value">
              {t(sourceKey(version.source.romVersion))}
            </span>
          )}
        </div>
        <div className="game-version-row">
          <span className="game-version-label">{t('KeychipPage.GameVersions.Data')}</span>
          <span className="game-version-value font-monospace">{version.effective.dataVersion}</span>
          {version.source.romVersion !== version.source.dataVersion && (
            <span className="game-version-source-per-value">
              {t(sourceKey(version.source.dataVersion))}
            </span>
          )}
        </div>
      </div>
      {version.source.romVersion === version.source.dataVersion && (
        <div className="game-version-source-combined">
          <span className="game-version-label">{t('KeychipPage.GameVersions.Source')}</span>
          <span>{t(sourceKey(version.source.romVersion))}</span>
        </div>
      )}
    </article>
  );

  return (
    <div className="content">
      <h1 className="page-heading">{t('KeychipPage.Title')}</h1>
      <div className="callout callout-info">
        <h5>{t('KeychipPage.Lead')}</h5>
        <p dangerouslySetInnerHTML={{ __html: t('KeychipPage.LeadDesc') }} />
        <pre className="m-0" style={{ textWrap: 'inherit' }}>
          <code data-lang="ini">[keychip]
  id=XXXX-XXXXXXXXXXX</code>
        </pre>
      </div>
      <div className="hstack alert alert-danger" role="alert">
        <ExclamationTriangleFill className="me-2" />
        <div>{t('KeychipPage.Warning2')}</div>
      </div>
      <div className="hstack alert alert-info" role="alert">
        <InfoCircleFill className="me-2" />
        <div>{t('KeychipPage.Warning1')}</div>
      </div>
      <h2 className="mb-3 mt-4">{t('KeychipPage.MyKeychips')}</h2>
      <div className="hstack alert alert-warning" role="alert">
        <ExclamationTriangleFill className="me-2" />
        <div>{t('KeychipPage.Warning3')}</div>
      </div>

      {keychipLoaded && (
        <div className="row px-2 mb-3">
          {keychips.map((keychip) => (
            <div className="col-lg-6 p-1" key={keychip.id}>
              <div className="card">
                <div className="card-header keychip-card-header">
                  <div className="keychip-card-title">
                    <span>
                      {keychip.id}
                      {t('Common.Colon')}
                      {keychip.placeName}
                    </span>
                  </div>
                  {keychip.whiteListed && (
                    <span className="badge text-bg-primary ms-2">{t('KeychipPage.Whitelisted')}</span>
                  )}
                  <div className="ms-auto">
                    <button className="btn btn-close" onClick={() => setRemoving(keychip)} />
                  </div>
                </div>
                <div className="card-body">
                  <div className="mb-2 fw-bold">
                    {t('KeychipPage.KeychipId')}
                    {t('Common.Colon')}
                  </div>
                  <div className="hstack mb-2">
                    <div className="font-monospace">{idDisplay(keychip)}</div>
                    {eyeControls(keychip)}
                  </div>
                  <div>
                    <a
                      className="card-link cursor-pointer"
                      onClick={() => {
                        setRenameInput(keychip.placeName);
                        setRenaming(keychip);
                      }}
                    >
                      {t('KeychipPage.Rename')}
                    </a>
                  </div>
                  {!!keychip.gameVersions?.length && (
                    <section className="game-versions mt-3" aria-label={t('KeychipPage.GameVersions.title')}>
                      <h3 className="game-versions-title">{t('KeychipPage.GameVersions.title')}</h3>
                      <div className="game-version-grid">
                        {keychip.gameVersions.map((version) => gameVersionPanel(keychip, version))}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="col p-1">
            <div className="card h-100 card-btn" onClick={genKeychip}>
              <div className="card-body d-flex justify-content-center align-items-center fs-4 text-secondary user-select-none">
                <PlusSquareDotted className="me-2" />
                <div>{t('KeychipPage.Generate')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="callout callout-info">
        <h5>{t('KeychipPage.WhitelistTipHeader')}</h5>
        <p className="m-0" dangerouslySetInnerHTML={{ __html: t('KeychipPage.WhitelistTipContent') }} />
      </div>
      <h2 className="mb-3 mt-4">{t('KeychipPage.TrustedKeychips')}</h2>
      <div className="hstack alert alert-warning" role="alert">
        <ExclamationTriangleFill className="me-2" />
        <div>{t('KeychipPage.Warning4')}</div>
      </div>

      {trustKeychipLoaded && (
        <div className="row px-2 mb-3">
          {trustKeychips.map((keychip) => (
            <div className="col-lg-6 p-1" key={keychip.id}>
              <div className="card trusted-keychip-card">
                <div className="card-header keychip-card-header">
                  <div className="keychip-card-title">
                    {keychip.id}
                    {t('Common.Colon')}
                    {keychip.placeName}
                  </div>
                  <div className="ms-auto">
                    <button className="btn btn-close" onClick={() => setUntrusting(keychip)} />
                  </div>
                </div>
                <div className="card-body">
                  <div className="mb-2 fw-bold">
                    {t('KeychipPage.KeychipId')}
                    {t('Common.Colon')}
                  </div>
                  <div className="mb-3 hstack align-items-center">
                    <div className="font-monospace align-middle">{idDisplay(keychip)}</div>
                    {eyeControls(keychip)}
                  </div>
                  <div className="mb-2 fw-bold">
                    {t('KeychipPage.Owner')}
                    {t('Common.Colon')}
                  </div>
                  <div className="hstack align-items-center">
                    <div className="font-monospace align-middle">{keychip.user.name}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div className="col p-1">
            <div className="card h-100 card-btn" onClick={() => setTrustModalOpen(true)}>
              <div className="card-body d-flex justify-content-center align-items-center fs-4 text-secondary user-select-none">
                <PlusSquareDotted className="me-2" />
                <div>{t('KeychipPage.AddToTrust')}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 移除机台 */}
      <BModal open={!!removing} onClose={() => setRemoving(null)} title={t('KeychipPage.Remove')}>
        <form>
          <div className="d-grid">
            <p className="mb-3 ms-1">{t('KeychipPage.RemoveMessage')}</p>
            <button className="btn btn-danger btn-sm" onClick={() => removing && onRemoveKeychip(removing)}>
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      {/* 重命名 */}
      <BModal open={!!renaming} onClose={() => setRenaming(null)} title={t('KeychipPage.Rename')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRenameSubmit();
          }}
        >
          <div className="d-grid">
            <input
              type="text"
              className="form-control mb-3"
              placeholder="机台名"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      {/* 取消信任 */}
      <BModal open={!!untrusting} onClose={() => setUntrusting(null)} title={t('KeychipPage.Untrust')}>
        <form>
          <div className="d-grid">
            <p className="mb-3 ms-1">{t('KeychipPage.UntrustMessage')}</p>
            <button className="btn btn-danger btn-sm" onClick={() => untrusting && onUntrustKeychip(untrusting)}>
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      {/* 添加信任机台 */}
      <BModal open={trustModalOpen} onClose={() => setTrustModalOpen(false)} title={t('KeychipPage.AddToTrust')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onTrustKeychipSubmit();
          }}
        >
          <div className="d-grid">
            <input
              type="text"
              className="form-control mb-3"
              placeholder="KeychipId"
              value={trustIdInput}
              onChange={(e) => setTrustIdInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!checkKeychipIdValid(trustIdInput)}>
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      {/* 游戏版本编辑器 */}
      <BModal open={!!editor} onClose={() => setEditor(null)}>
        {editor && (
          <div className="game-version-modal">
            <div className="modal-header">
              <h4 id="keychipGameVersionModalTitle" className="modal-title">
                {t('KeychipPage.GameVersions.' + editor.version.game)} · {t('KeychipPage.GameVersions.title')}
              </h4>
              <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditor(null)} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveGameVersion();
              }}
            >
              <div className="modal-body">
                <section className="game-version-observed mb-4">
                  <h5>{t('KeychipPage.GameVersions.Observed')}</h5>
                  <div className="game-version-modal-grid">
                    <div>
                      <div className="game-version-label">{t('KeychipPage.GameVersions.ROM')}</div>
                      <div className="game-version-value observed-rom font-monospace">
                        {editor.version.observed.romVersion ?? '—'}
                      </div>
                    </div>
                    <div>
                      <div className="game-version-label">{t('KeychipPage.GameVersions.Data')}</div>
                      <div className="game-version-value observed-data font-monospace">
                        {editor.version.observed.dataVersion ?? '—'}
                      </div>
                    </div>
                  </div>
                </section>
                <section className="game-version-manual">
                  <h5>{t('KeychipPage.GameVersions.Manual')}</h5>
                  <div className="game-version-modal-grid">
                    <div>
                      <label className="form-label game-version-label" htmlFor="manualRomVersion">
                        {t('KeychipPage.GameVersions.ROM')}
                      </label>
                      <input
                        id="manualRomVersion"
                        className="form-control font-monospace"
                        type="text"
                        required
                        autoComplete="off"
                        value={romVersion}
                        onChange={(e) => setRomVersion(e.target.value)}
                        onBlur={() => setVersionTouched(true)}
                      />
                      {versionTouched && !GAME_VERSION_PATTERN.test(romVersion) && (
                        <div id="manualRomVersionError" className="invalid-feedback d-block game-version-format-error" role="alert">
                          {t('KeychipPage.GameVersions.VersionFormat')}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="form-label game-version-label" htmlFor="manualDataVersion">
                        {t('KeychipPage.GameVersions.Data')}
                      </label>
                      <input
                        id="manualDataVersion"
                        className="form-control font-monospace"
                        type="text"
                        required
                        autoComplete="off"
                        value={dataVersion}
                        onChange={(e) => setDataVersion(e.target.value)}
                        onBlur={() => setVersionTouched(true)}
                      />
                      {versionTouched && !GAME_VERSION_PATTERN.test(dataVersion) && (
                        <div id="manualDataVersionError" className="invalid-feedback d-block game-version-format-error" role="alert">
                          {t('KeychipPage.GameVersions.VersionFormat')}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>
              <div className="modal-footer game-version-actions">
                {editor.version.manual.romVersion !== null && editor.version.manual.dataVersion !== null && (
                  <button
                    type="button"
                    className="btn btn-danger me-auto game-version-restore"
                    disabled={mutationPending}
                    onClick={requestClearGameVersion}
                  >
                    {t(
                      restoreConfirmationPending
                        ? 'KeychipPage.GameVersions.RestoreConfirm'
                        : 'KeychipPage.GameVersions.RestoreAutomatic',
                    )}
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setEditor(null)}>
                  {t('KeychipPage.GameVersions.Cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={mutationPending}>
                  {t('KeychipPage.GameVersions.Save')}
                </button>
              </div>
            </form>
          </div>
        )}
      </BModal>
    </div>
  );
}

function sourceKey(source: GameVersionSource): string {
  switch (source) {
    case 'MANUAL':
      return 'KeychipPage.GameVersions.ManualSource';
    case 'OBSERVED':
      return 'KeychipPage.GameVersions.ObservedSource';
    default:
      return 'KeychipPage.GameVersions.DefaultSource';
  }
}
