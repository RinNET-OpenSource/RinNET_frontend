import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import type { ChuniV2Profile } from './models';
import './ChuniV2SettingPage.css';

const USER_NAME_SYMBOLS = [
  'Ａ', 'Ｂ', 'Ｃ', 'Ｄ', 'Ｅ', 'Ｆ', 'Ｇ', 'Ｈ', 'Ｉ', 'Ｊ', 'Ｋ', 'Ｌ', 'Ｍ', 'Ｎ', 'Ｏ', 'Ｐ', 'Ｑ', 'Ｒ', 'Ｓ', 'Ｔ', 'Ｕ', 'Ｖ', 'Ｗ', 'Ｘ', 'Ｙ', 'Ｚ',
  '．', '・', '：', '；', '？', '！', '～', '／', '＋', '－', '×', '÷', '＝', '♂', '♀', '∀', '＃', '＆', '＊', '＠', '☆',
  '○', '◎', '◇', '□', '△', '▽', '♪', '†', '‡', 'Σ', 'α', 'β', 'γ', 'θ', 'φ', 'ψ', 'ω', 'Д', 'ё',
];

type VersionKind = 'data' | 'rom';

function LegacySettingModal({
  children,
  onClose,
  open,
}: {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="chuni-v2-setting-dialog max-w-lg gap-0 border-0 bg-transparent p-0 shadow-none"
      >
        <div className="modal-content">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Equivalent to the legacy Chunithm v2 settings component. */
export function ChuniV2SettingPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChuniV2Profile | null>(null);
  const [aimeId, setAimeId] = useState('');
  const [nameOpen, setNameOpen] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [versionKind, setVersionKind] = useState<VersionKind | null>(null);
  const [versionInput, setVersionInput] = useState('');
  const [versionTouched, setVersionTouched] = useState(false);
  const versionValid = /^\d\.\d{2}\.\d{2}$/.test(versionInput);

  useEffect(() => {
    void (async () => {
      try {
        await loadUser();
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        setAimeId(id);
        setProfile((await api.get('api/game/chuni/v2/profile', { aimeId: id })) as ChuniV2Profile);
      } catch (error) {
        notice(String(error));
      }
    })();
  }, []);

  const openName = () => {
    setNameInput(profile?.userName ?? '');
    setNameOpen(true);
  };

  const openVersion = (kind: VersionKind) => {
    setVersionKind(kind);
    setVersionInput(kind === 'data' ? profile?.lastDataVersion ?? '' : profile?.lastRomVersion ?? '');
    setVersionTouched(false);
  };

  const applyName = async () => {
    if (!nameInput) return;
    try {
      const updated = await api.put('api/game/chuni/v2/profile/username', {
        aimeId,
        userName: nameInput,
      });
      setProfile(updated as ChuniV2Profile);
      notice('Successfully changed');
      setNameOpen(false);
    } catch (error) {
      notice(String(error));
    }
  };

  const applyVersion = async () => {
    setVersionTouched(true);
    if (!versionKind || !versionValid) return;
    const path = versionKind === 'data'
      ? 'api/game/chuni/v2/profile/dataversion'
      : 'api/game/chuni/v2/profile/romversion';
    const key = versionKind === 'data' ? 'dataVersion' : 'romVersion';
    try {
      const updated = await api.put(path, { aimeId, [key]: versionInput });
      setProfile(updated as ChuniV2Profile);
      notice('Successfully changed');
      setVersionKind(null);
    } catch (error) {
      notice(String(error));
    }
  };

  const downloadFile = async () => {
    try {
      const blob = await api.blob('api/game/chuni/v2/export', { aimeId });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `chusan_${aimeId}_exported.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      notice('Chunithm Download Over');
    } catch (error) {
      notice(String(error));
    }
  };

  return (
    <div className="content chuni-v2-setting-page">
      <h1 className="page-heading">{t('ChuniV2.SettingsPage.Title')}</h1>

      {profile && (
        <>
          <h2 className="mb-3">{t('ChuniV2.SettingsPage.Profile')}</h2>
          <div className="card mb-3">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div>
                  <span>{t('ChuniV2.SettingsPage.UserName')}{t('Common.Colon')}</span>
                  <span>{profile.userName}</span>
                </div>
                <a className="text-primary" onClick={openName}>
                  {t('ChuniV2.SettingsPage.Edit')}
                </a>
              </div>
            </div>
          </div>

          <h2 className="mb-3">{t('ChuniV2.SettingsPage.Versionfile')}</h2>
          <div className="version-box">
            <div className="card">
              <div className="card-header">{t('ChuniV2.SettingsPage.DataVersion')}</div>
              <div className="card-body">
                <h5 className="card-title version font-monospace">{profile.lastDataVersion}</h5>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-muted small align-text-bottom">
                    ※ {t('ChuniV2.SettingsPage.MessageDataVersion')}
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => openVersion('data')}>
                    {t('ChuniV2.SettingsPage.Change')}
                  </button>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header">{t('ChuniV2.SettingsPage.RomVersion')}</div>
              <div className="card-body">
                <h5 className="card-title version font-monospace">{profile.lastRomVersion}</h5>
                <div className="d-flex justify-content-between align-items-center">
                  <div className="text-muted small align-text-bottom">
                    ※ {t('ChuniV2.SettingsPage.MessageRomVersion')}
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => openVersion('rom')}>
                    {t('ChuniV2.SettingsPage.Change')}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button className="mt-3 btn btn-primary w-100" onClick={() => void downloadFile()}>
            {t('ChuniV2.SettingsPage.Export')}
          </button>
        </>
      )}

      <LegacySettingModal open={nameOpen} onClose={() => setNameOpen(false)}>
        <div className="modal-body">
          <h2>{t('ChuniV2.SettingsPage.ChangeUserName')}</h2>
          <hr />
          <div className="input-group mb-3">
            <span className="input-group-text">{t('ChuniV2.SettingsPage.UserName')}</span>
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              type="text"
              className="form-control"
              placeholder="Username"
              aria-label="Username"
            />
          </div>
          <div>※ {t('ChuniV2.SettingsPage.MessageChangeUserName1')}</div>
          <div>※ {t('ChuniV2.SettingsPage.MessageChangeUserName2')}</div>
          <div className="btns">
            {USER_NAME_SYMBOLS.map((symbol) => (
              <button
                type="button"
                className="mt-2 btn btn-outline-secondary btn-sm"
                onClick={() => setNameInput((value) => value + symbol)}
                key={symbol}
              >
                {symbol}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setNameOpen(false)}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={() => void applyName()}>Apply</button>
        </div>
      </LegacySettingModal>

      <LegacySettingModal open={versionKind !== null} onClose={() => setVersionKind(null)}>
        <div className="modal-body">
          <h2>
            {t(versionKind === 'data'
              ? 'ChuniV2.SettingsPage.ModifyDataVersion'
              : 'ChuniV2.SettingsPage.ModifyRomVersion')}
          </h2>
          <p
            style={{
              color: versionTouched && !versionValid ? 'var(--bs-form-invalid-border-color)' : 'inherit',
              fontWeight: versionTouched && !versionValid ? 'bold' : 'normal',
              transition: 'all 0.5s',
            }}
          >
            Version format is x.xx.xx
          </p>
          <div className="input-group mb-3">
            <span className="input-group-text">Version</span>
            <input
              value={versionInput}
              onBlur={() => setVersionTouched(true)}
              onChange={(event) => setVersionInput(event.target.value)}
              type="text"
              className="form-control"
              placeholder="x.xx.xx"
              style={{ borderColor: versionTouched && !versionValid ? 'var(--bs-form-invalid-border-color)' : 'var(--bs-border-color)' }}
              required
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setVersionKind(null)}>Cancel</button>
          <button type="button" className="btn btn-primary" disabled={!versionValid} onClick={() => void applyVersion()}>Apply</button>
        </div>
      </LegacySettingModal>
    </div>
  );
}
