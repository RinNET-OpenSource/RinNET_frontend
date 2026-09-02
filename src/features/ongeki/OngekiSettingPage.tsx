import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InfoCircleFill } from 'react-bootstrap-icons';
import { BModal } from '@/components/shared/BModal';
import { api, rawFetch } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser } from '@/lib/user';
import type { DisplayOngekiProfile } from './models';

const VERSION_PATTERN = /^([0-9]+)\.([0-9]+)(\.([0-9]+))?$/;

function canMakeVersion(src: string): boolean {
  const match = src.match(VERSION_PATTERN);
  if (!match) return false;
  try {
    const major = parseInt(match[1]);
    const minor = parseInt(match[2]);
    let patch = 0;
    if (match[4]) patch = parseInt(match[4]);
    return major <= 0xffff && minor < 0xff && patch < 0xff;
  } catch {
    return false;
  }
}

function toFullWidthInput(input: string): string {
  return input.replace(/[\u0020-\u007E]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0));
}

type ModalKind = 'none' | 'userName' | 'romVersion' | 'dataVersion';

/** 等价旧版 ongeki-setting.component */
export function OngekiSettingPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<DisplayOngekiProfile | null>(null);
  const [modal, setModal] = useState<ModalKind>('none');
  const [userName, setUserName] = useState('');
  const [romVersion, setRomVersion] = useState('');
  const [dataVersion, setDataVersion] = useState('');
  const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');

  useEffect(() => {
    void api
      .get('api/game/ongeki/profile')
      .then((data) => setProfile(data as DisplayOngekiProfile))
      .catch((error) => notice(String(error)));
  }, []);

  function onUserNameInput(value: string) {
    const full = toFullWidthInput(value).substring(0, 8);
    setUserName(full);
  }

  async function downloadFile() {
    notice(t('Ongeki.SettingsPage.DownloadingProfile'));
    try {
      const resp = await rawFetch('api/game/ongeki/export');
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const blob = await resp.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `ongeki_${aimeId}_exported.json`;
      a.click();
      document.body.appendChild(a);
      document.body.removeChild(a);
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      notice(String(error));
    }
  }

  function onChangeUserName() {
    if (!userName || userName.length > 8) return;
    void api
      .post('api/game/ongeki/profile/userName', { userName })
      .then((resp) => {
        if (resp?.userName === userName) {
          setUserName('');
          setProfile(resp);
          setModal('none');
        } else {
          notice(t('Ongeki.SettingsPage.ChangeUserNameFailed'), 'warning');
        }
      })
      .catch((error) => notice(String(error)));
  }

  function onChangeRomVersion() {
    if (!romVersion || !canMakeVersion(romVersion)) return;
    void api
      .put('api/game/ongeki/profile/romversion', { romVersion })
      .then((resp) => {
        if (resp?.lastRomVersion === romVersion) {
          setRomVersion('');
          setProfile(resp);
          setModal('none');
        } else {
          notice(t('Ongeki.SettingsPage.ModifyRomVersionFailed'), 'warning');
        }
      })
      .catch((error) => notice(String(error)));
  }

  function onChangeDataVersion() {
    if (!dataVersion || !canMakeVersion(dataVersion)) return;
    void api
      .put('api/game/ongeki/profile/dataversion', { dataVersion })
      .then((resp) => {
        if (resp?.lastDataVersion === dataVersion) {
          setDataVersion('');
          setProfile(resp);
          setModal('none');
        } else {
          notice(t('Ongeki.SettingsPage.ModifyDataVersionFailed'), 'warning');
        }
      })
      .catch((error) => notice(String(error)));
  }

  if (!profile) return null;

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.SettingsPage.Title')}</h1>
      <h2 className="mb-3">{t('Ongeki.SettingsPage.Profile')}</h2>
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between">
            <div>
              <span>{t('Ongeki.SettingsPage.UserName')}</span>
              {t('Common.Colon')}
              <span>{profile.userName}</span>
            </div>
            <a
              className="text-primary cursor-pointer"
              onClick={() => {
                onUserNameInput(profile.userName);
                setModal('userName');
              }}
            >
              {t('Ongeki.SettingsPage.Edit')}
            </a>
          </div>
        </div>
      </div>
      <div className="hstack alert alert-info" role="alert">
        <InfoCircleFill className="me-2" />
        {t('Ongeki.SettingsPage.Message1')}
      </div>
      <div className="card mb-3">
        <div className="card-body">
          <div className="d-flex justify-content-between">
            <div>
              <span>{t('Ongeki.SettingsPage.RomVersion')}</span>
              {t('Common.Colon')}
              <span>{profile.lastRomVersion}</span>
            </div>
            <a
              className="text-primary cursor-pointer"
              onClick={() => {
                setRomVersion(profile.lastRomVersion);
                setModal('romVersion');
              }}
            >
              {t('Ongeki.SettingsPage.Edit')}
            </a>
          </div>
          <div className="d-flex justify-content-between">
            <div>
              <span>{t('Ongeki.SettingsPage.DataVersion')}</span>
              {t('Common.Colon')}
              <span>{profile.lastDataVersion}</span>
            </div>
            <a
              className="text-primary cursor-pointer"
              onClick={() => {
                setDataVersion(profile.lastDataVersion);
                setModal('dataVersion');
              }}
            >
              {t('Ongeki.SettingsPage.Edit')}
            </a>
          </div>
        </div>
      </div>
      <a className="btn btn-primary w-100 cursor-pointer" onClick={() => void downloadFile()}>
        {t('Ongeki.SettingsPage.Export')}
      </a>

      <BModal open={modal === 'userName'} onClose={() => setModal('none')} title={t('Ongeki.SettingsPage.ChangeUserName')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onChangeUserName();
          }}
        >
          <div className="d-grid">
            <input
              type="text"
              className={'form-control mb-3' + (userName.length > 8 ? ' is-invalid' : '')}
              placeholder={t('Ongeki.SettingsPage.UserName')}
              value={userName}
              onChange={(e) => onUserNameInput(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      <BModal open={modal === 'romVersion'} onClose={() => setModal('none')} title={t('Ongeki.SettingsPage.ModifyRomVersion')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onChangeRomVersion();
          }}
        >
          <div className="d-grid">
            <input
              type="text"
              className={'form-control mb-3' + (romVersion && !canMakeVersion(romVersion) ? ' is-invalid' : '')}
              placeholder={t('Ongeki.SettingsPage.RomVersion')}
              value={romVersion}
              onChange={(e) => setRomVersion(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      <BModal open={modal === 'dataVersion'} onClose={() => setModal('none')} title={t('Ongeki.SettingsPage.ModifyDataVersion')}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onChangeDataVersion();
          }}
        >
          <div className="d-grid">
            <input
              type="text"
              className={'form-control mb-3' + (dataVersion && !canMakeVersion(dataVersion) ? ' is-invalid' : '')}
              placeholder={t('Ongeki.SettingsPage.ModifyDataVersion')}
              value={dataVersion}
              onChange={(e) => setDataVersion(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>
    </div>
  );
}
