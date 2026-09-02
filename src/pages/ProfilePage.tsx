import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import './pages-common.css';
import './auth/auth.css';
import { BModal } from '@/components/shared/BModal';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { StatusCode } from '@/lib/models';
import { tokenTypes, getSignInUrl } from '@/lib/auth/oauth';
import {
  webauthnList,
  webauthnRegister,
  webauthnRemove,
  isWebAuthnSupported,
  isWebAuthnAborted,
} from '@/lib/auth/webauthn';
import { getAccount, setAccount } from '@/lib/auth/account';
import { loadUser, userStore } from '@/lib/user';
import { useStore } from '@/lib/store';

interface Passkey {
  id: number;
  nick: string;
  credentialId: string;
}

/** 等价旧版 profile.component（个人信息 / OAuth 绑定 / TOTP / Passkey） */
export function ProfilePage() {
  const { t } = useTranslation();
  const location = useLocation();
  const user = useStore(userStore);
  const providers = [...tokenTypes.keys()];
  const webAuthnSupported = isWebAuthnSupported();

  // OAuth link（回调携带 state）
  const [linkToken, setLinkToken] = useState<string | undefined>();
  const [linkType, setLinkType] = useState<string | undefined>();
  const [linkEmail, setLinkEmail] = useState<string | undefined>();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTotpCode, setLinkTotpCode] = useState('');

  // passkeys
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [passkeysLoaded, setPasskeysLoaded] = useState(false);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [addPasskeyOpen, setAddPasskeyOpen] = useState(false);
  const [passkeyNick, setPasskeyNick] = useState('');
  const [passkeyTotp, setPasskeyTotp] = useState('');
  const [removingPasskey, setRemovingPasskey] = useState<Passkey | null>(null);

  // TOTP
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpQr, setTotpQr] = useState<string | null>(null);
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpRecoveryRemaining, setTotpRecoveryRemaining] = useState(0);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [disableModalOpen, setDisableModalOpen] = useState(false);
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [totpPassword, setTotpPassword] = useState('');
  const [enableCode, setEnableCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');

  // unlink
  const [unlinking, setUnlinking] = useState<number | null>(null);

  useEffect(() => {
    const state = location.state as { token?: string; type?: string; email?: string } | null;
    if (state) {
      if (tokenTypes.has(state.type ?? '') && state.token?.length === 32) {
        setLinkToken(state.token);
        setLinkType(state.type);
        setLinkEmail(state.email);
      }
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadUser();
    loadPasskeys();
    loadTotpStatus();
    if (linkToken && linkType && linkEmail) {
      setLinkModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToken]);

  function findOAuth(provider: string) {
    return user?.oauth2s?.find((oauth) => oauth.provider === provider);
  }

  function doLink(code?: string) {
    const params: any = { token: linkToken };
    if (code) params.code = code;
    void api
      .post('api/user/oauth2', params)
      .then((resp) => {
        if (resp?.status) {
          const statusCode: number = resp.status.code;
          if (statusCode === StatusCode.OK) {
            void loadUser(true);
            setLinkModalOpen(false);
          } else if (
            statusCode === StatusCode.TOTP_REQUIRED ||
            statusCode === StatusCode.TOTP_INVALID ||
            statusCode === StatusCode.TOTP_TOO_MANY_ATTEMPTS
          ) {
            notifyTotpCodeError(resp);
          } else {
            notice(resp.status.message);
            setLinkModalOpen(false);
          }
        } else {
          notice('Link failed.');
          setLinkModalOpen(false);
        }
      })
      .catch((error) => {
        notice(String(error));
        setLinkModalOpen(false);
      });
  }

  function onUnlink(id: number) {
    void api
      .delete(`api/user/oauth2/${id}`)
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK) {
            void loadUser(true);
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Unlink failed.');
        }
      })
      .catch((error) => notice(String(error)));
  }

  function loadPasskeys() {
    void webauthnList()
      .then((resp) => {
        if (resp?.status?.code === StatusCode.OK) {
          setPasskeys(resp.data ?? []);
        }
        setPasskeysLoaded(true);
      })
      .catch((error) => {
        setPasskeysLoaded(true);
        console.warn('load passkeys fail', error);
      });
  }

  async function onAddPasskey() {
    if (addingPasskey) return;
    setAddingPasskey(true);
    try {
      const nick = passkeyNick.trim() ? passkeyNick.trim() : 'Passkey';
      const resp = await webauthnRegister(nick, totpEnabled ? passkeyTotp : undefined);
      if (
        resp?.status?.code === StatusCode.TOTP_REQUIRED ||
        resp?.status?.code === StatusCode.TOTP_INVALID ||
        resp?.status?.code === StatusCode.TOTP_TOO_MANY_ATTEMPTS
      ) {
        notifyTotpCodeError(resp);
        return;
      }
      if (resp?.status?.code === StatusCode.OK) {
        setAddPasskeyOpen(false);
        notice(t('ProfilePage.PasskeyAddedMessage'));
        loadPasskeys();
      } else {
        notifyPasskeyError();
      }
    } catch (e) {
      if (!isWebAuthnAborted(e)) {
        console.warn('add passkey fail', e);
        notifyPasskeyError();
      }
    } finally {
      setAddingPasskey(false);
    }
  }

  function onRemovePasskey(id: number) {
    void webauthnRemove(id)
      .then((resp) => {
        if (resp?.status?.code === StatusCode.OK) {
          loadPasskeys();
        } else {
          notice(resp?.status?.message);
        }
      })
      .catch((error) => notice(String(error)));
  }

  function notifyPasskeyError() {
    notice(t('ProfilePage.PasskeyErrorMessage'), 'danger');
  }

  function loadTotpStatus() {
    void api
      .get('api/user/totp')
      .then((resp) => {
        if (resp?.status?.code === StatusCode.OK) {
          setTotpEnabled(!!resp.data?.enabled);
          setTotpRecoveryRemaining(resp.data?.recoveryCodesRemaining ?? 0);
        }
      })
      .catch((error) => console.warn('load totp status fail', error));
  }

  function startTotpSetup() {
    setTotpBusy(true);
    void api
      .post('api/user/totp/setup', { password: totpPassword })
      .then((resp) => {
        setTotpBusy(false);
        if (resp?.status?.code === StatusCode.PASSWORD_INCORRECT) {
          notice(t('ProfilePage.TotpPasswordIncorrect'), 'danger');
          return;
        }
        if (resp?.status?.code !== StatusCode.OK || !resp.data) {
          notice(resp?.status?.message);
          setPasswordModalOpen(false);
          return;
        }
        setPasswordModalOpen(false);
        setTotpSecret(resp.data.secret);
        QRCode.toDataURL(resp.data.uri, { margin: 1, width: 220 })
          .then((url) => {
            setTotpQr(url);
            setSetupModalOpen(true);
          })
          .catch((err) => {
            console.warn('qr render fail', err);
            setTotpQr(null);
            setSetupModalOpen(true);
          });
      })
      .catch((error) => {
        setTotpBusy(false);
        notice(String(error));
      });
  }

  function enableTotp() {
    setTotpBusy(true);
    void api
      .post('api/user/totp/enable', { code: enableCode })
      .then((resp) => {
        setTotpBusy(false);
        if (resp?.status?.code === StatusCode.OK) {
          setTotpEnabled(true);
          setTotpSecret(null);
          setTotpQr(null);
          adoptRotatedTokens(resp.data?.tokens);
          setSetupModalOpen(false);
          notice(t('ProfilePage.TotpEnabledMessage'));
          showRecoveryCodes(resp.data?.recoveryCodes);
        } else {
          notifyTotpCodeError(resp);
        }
      })
      .catch((error) => {
        setTotpBusy(false);
        notice(String(error));
      });
  }

  function regenerateRecoveryCodes() {
    setTotpBusy(true);
    void api
      .post('api/user/totp/recoveryCodes', { code: regenCode })
      .then((resp) => {
        setTotpBusy(false);
        if (resp?.status?.code === StatusCode.OK) {
          setRegenModalOpen(false);
          showRecoveryCodes(resp.data?.recoveryCodes);
        } else {
          notifyTotpCodeError(resp);
        }
      })
      .catch((error) => {
        setTotpBusy(false);
        notice(String(error));
      });
  }

  function adoptRotatedTokens(tokens: any) {
    if (tokens?.accessToken && tokens?.refreshToken) {
      const current = getAccount();
      if (current) {
        setAccount({
          ...current,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
      }
    }
  }

  function showRecoveryCodes(codes: string[] | null | undefined) {
    if (!codes?.length) {
      loadTotpStatus();
      return;
    }
    setRecoveryCodes(codes);
    setTotpRecoveryRemaining(codes.length);
  }

  function copyRecoveryCodes() {
    navigator.clipboard
      ?.writeText((recoveryCodes ?? []).join('\n'))
      .then(
        () => notice(t('ProfilePage.TotpRecoveryCopied')),
        () => {},
      );
  }

  function disableTotp() {
    setTotpBusy(true);
    void api
      .post('api/user/totp/disable', { code: disableCode })
      .then((resp) => {
        setTotpBusy(false);
        if (resp?.status?.code === StatusCode.OK) {
          setTotpEnabled(false);
          setTotpRecoveryRemaining(0);
          adoptRotatedTokens(resp.data?.tokens);
          setDisableModalOpen(false);
          notice(t('ProfilePage.TotpDisabledMessage'));
        } else {
          notifyTotpCodeError(resp);
        }
      })
      .catch((error) => {
        setTotpBusy(false);
        notice(String(error));
      });
  }

  function notifyTotpCodeError(resp: any) {
    const key =
      resp?.status?.code === StatusCode.TOTP_INVALID
        ? 'ProfilePage.TotpInvalidMessage'
        : resp?.status?.code === StatusCode.TOTP_TOO_MANY_ATTEMPTS
          ? 'ProfilePage.TotpLockedMessage'
          : resp?.status?.code === StatusCode.TOTP_REQUIRED
            ? 'ProfilePage.TotpCodeRequired'
            : null;
    if (key) {
      notice(t(key), 'danger');
    } else {
      notice(resp?.status?.message);
    }
  }

  return (
    <div className="content">
      <h1 className="page-heading">{t('ProfilePage.Title')}</h1>
      <h2 className="mb-3 mt-4">{t('ProfilePage.PersonalInformation')}</h2>
      {user && (
        <div className="card mb-4">
          <div className="card-body row g-3">
            {[
              [t('ProfilePage.Nickname'), user.name],
              [t('ProfilePage.Username'), user.username],
              [t('ProfilePage.Email'), user.email],
              [t('ProfilePage.Password'), '********'],
            ].map(([lead, value]) => (
              <div className="col-container col-12" key={lead}>
                <div className="row col-content">
                  <div className="col-sm-auto">
                    <span className="col-lead">{lead}</span>
                  </div>
                  <div className="col col-value">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3">{t('ProfilePage.LinkedAccounts')}</h2>
      {user && (
        <div className="card mb-4">
          <div className="card-body row g-3">
            {providers.map((provider) => {
              const oauth = findOAuth(provider);
              return (
                <div className="col-container col-12" key={provider}>
                  <div className="row col-content">
                    <div className="col-sm-auto">
                      <span className="col-lead m-0">
                        <svg className="oauth-icon" viewBox="0 0 16 16">
                          <use href={`assets/${provider}.svg#icon`} />
                        </svg>
                        {tokenTypes.get(provider)}
                      </span>
                    </div>
                    {oauth ? (
                      <div className="col col-value">{oauth.email}</div>
                    ) : (
                      <div className="col col-value">{t('ProfilePage.NotLinked')}</div>
                    )}
                  </div>
                  {oauth ? (
                    <a className="col-action" onClick={() => setUnlinking(oauth.id)}>
                      {t('ProfilePage.Unlink')}
                    </a>
                  ) : (
                    <a className="col-action" onClick={() => getSignInUrl(provider)}>
                      {t('ProfilePage.Link')}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="mb-3">{t('ProfilePage.TwoFactor')}</h2>
      <div className="card mb-4">
        <div className="card-body row g-3">
          <div className="col-container col-12">
            <div className="row col-content">
              <div className="col-sm-auto">
                <span className="col-lead">{t('ProfilePage.Totp')}</span>
              </div>
              <div className="col col-value">
                {t(totpEnabled ? 'ProfilePage.TotpOn' : 'ProfilePage.TotpOff')}
              </div>
            </div>
            {!totpEnabled && (
              <a
                className="col-action"
                onClick={() => {
                  setTotpPassword('');
                  setPasswordModalOpen(true);
                }}
              >
                {t('ProfilePage.TotpEnable')}
              </a>
            )}
            {totpEnabled && (
              <a
                className="col-action"
                onClick={() => {
                  setDisableCode('');
                  setDisableModalOpen(true);
                }}
              >
                {t('ProfilePage.TotpDisable')}
              </a>
            )}
          </div>
          {totpEnabled && (
            <div className="col-container col-12">
              <div className="row col-content">
                <div className="col-sm-auto">
                  <span className="col-lead">{t('ProfilePage.TotpRecovery')}</span>
                </div>
                <div className="col col-value">
                  {t('ProfilePage.TotpRecoveryRemaining', { count: totpRecoveryRemaining })}
                </div>
              </div>
              <a
                className="col-action"
                onClick={() => {
                  setRegenCode('');
                  setRegenModalOpen(true);
                }}
              >
                {t('ProfilePage.TotpRecoveryRegenerate')}
              </a>
            </div>
          )}
          <div className="col-12 small text-secondary">{t('ProfilePage.TotpTip')}</div>
        </div>
      </div>

      <h2 className="mb-3">{t('ProfilePage.Passkeys')}</h2>
      <div className="card mb-4">
        <div className="card-body row g-3">
          {passkeysLoaded && passkeys.length === 0 && (
            <div className="col-12">{t('ProfilePage.NoPasskeys')}</div>
          )}
          {passkeys.map((passkey) => (
            <div className="col-container col-12" key={passkey.id}>
              <div className="row col-content">
                <div className="col-sm-auto">
                  <span className="col-lead">{passkey.nick}</span>
                </div>
                <div className="col col-value">{passkey.credentialId}</div>
              </div>
              <a className="col-action" onClick={() => setRemovingPasskey(passkey)}>
                {t('ProfilePage.RemovePasskey')}
              </a>
            </div>
          ))}
          {webAuthnSupported && (
            <div className="col-12">
              <button
                className={'btn btn-primary btn-sm' + (addingPasskey ? ' disabled' : '')}
                onClick={() => {
                  setPasskeyNick('');
                  setPasskeyTotp('');
                  setAddPasskeyOpen(true);
                }}
              >
                {t('ProfilePage.AddPasskey')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 恢复码（唯一一次明文展示） */}
      <BModal open={!!recoveryCodes} onClose={() => {}} title={t('ProfilePage.TotpRecovery')}>
        <div className="d-grid">
          <p className="mb-3 ms-1 text-danger-emphasis">{t('ProfilePage.TotpRecoveryWarning')}</p>
          <pre className="bg-body-secondary rounded p-3 mb-3 user-select-all">
            {recoveryCodes?.join('\n')}
          </pre>
          <button className="btn btn-outline-primary btn-sm mb-2" onClick={copyRecoveryCodes}>
            {t('ProfilePage.TotpRecoveryCopy')}
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setRecoveryCodes(null);
              loadTotpStatus();
            }}
          >
            {t('ProfilePage.TotpRecoverySaved')}
          </button>
        </div>
      </BModal>

      {/* 重新生成恢复码 */}
      <BModal open={regenModalOpen} onClose={() => setRegenModalOpen(false)} title={t('ProfilePage.TotpRecoveryRegenerate')}>
        <div className="d-grid">
          <p className="mb-3 ms-1">{t('ProfilePage.TotpRecoveryRegenerateTip')}</p>
          <input
            type="text"
            className="form-control form-control-sm mb-3"
            autoComplete="one-time-code"
            maxLength={11}
            placeholder={t('ProfilePage.TotpCode')}
            value={regenCode}
            onChange={(e) => setRegenCode(e.target.value)}
          />
          <button className={'btn btn-primary btn-sm' + (totpBusy ? ' disabled' : '')} onClick={regenerateRecoveryCodes}>
            {t('Common.OK')}
          </button>
        </div>
      </BModal>

      {/* 启用 TOTP：输入密码 */}
      <BModal open={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} title={t('ProfilePage.TotpEnable')}>
        <div className="d-grid">
          <p className="mb-3 ms-1">{t('ProfilePage.TotpPasswordTip')}</p>
          <input
            type="password"
            className="form-control form-control-sm mb-3"
            autoComplete="current-password"
            placeholder={t('ProfilePage.Password')}
            value={totpPassword}
            onChange={(e) => setTotpPassword(e.target.value)}
          />
          <button className={'btn btn-primary btn-sm' + (totpBusy ? ' disabled' : '')} onClick={startTotpSetup}>
            {t('Common.OK')}
          </button>
        </div>
      </BModal>

      {/* 启用 TOTP：扫码验证 */}
      <BModal open={setupModalOpen} onClose={() => setSetupModalOpen(false)} title={t('ProfilePage.TotpEnable')}>
        <div className="d-grid text-center">
          <p className="mb-2 small">{t('ProfilePage.TotpScanTip')}</p>
          {totpQr && <img src={totpQr} alt="TOTP QR" className="mx-auto mb-2" style={{ maxWidth: 220 }} />}
          <p className="mb-1 small text-secondary">{t('ProfilePage.TotpSecret')}</p>
          <p className="mb-3 font-monospace user-select-all text-break">{totpSecret}</p>
          <label htmlFor="totp-enable-code" className="form-label small text-start">
            {t('ProfilePage.TotpCode')}
          </label>
          <input
            type="text"
            className="form-control form-control-sm mb-3"
            id="totp-enable-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={enableCode}
            onChange={(e) => setEnableCode(e.target.value)}
          />
          <button className={'btn btn-primary btn-sm' + (totpBusy ? ' disabled' : '')} onClick={enableTotp}>
            {t('Common.OK')}
          </button>
        </div>
      </BModal>

      {/* 关闭 TOTP */}
      <BModal open={disableModalOpen} onClose={() => setDisableModalOpen(false)} title={t('ProfilePage.TotpDisable')}>
        <div className="d-grid">
          <p className="mb-3 ms-1">{t('ProfilePage.TotpDisableTip')}</p>
          <input
            type="text"
            className="form-control form-control-sm mb-3"
            autoComplete="one-time-code"
            maxLength={11}
            placeholder={t('ProfilePage.TotpCode')}
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
          />
          <button className={'btn btn-danger btn-sm' + (totpBusy ? ' disabled' : '')} onClick={disableTotp}>
            {t('Common.OK')}
          </button>
        </div>
      </BModal>

      {/* 添加 passkey */}
      <BModal open={addPasskeyOpen} onClose={() => setAddPasskeyOpen(false)} title={t('ProfilePage.AddPasskey')}>
        <form>
          <div className="d-grid">
            <label htmlFor="passkey-nick" className="form-label small">
              {t('ProfilePage.PasskeyNick')}
            </label>
            <input
              type="text"
              className="form-control form-control-sm mb-3"
              id="passkey-nick"
              maxLength={32}
              value={passkeyNick}
              onChange={(e) => setPasskeyNick(e.target.value)}
            />
            <div hidden={!totpEnabled}>
              <label htmlFor="passkey-totp" className="form-label small">
                {t('ProfilePage.TotpCode')}
              </label>
              <input
                type="text"
                className="form-control form-control-sm mb-3 w-100"
                id="passkey-totp"
                autoComplete="one-time-code"
                maxLength={11}
                value={passkeyTotp}
                onChange={(e) => setPasskeyTotp(e.target.value)}
              />
            </div>
            <button
              type="button"
              className={'btn btn-primary btn-sm' + (addingPasskey ? ' disabled' : '')}
              onClick={() => void onAddPasskey()}
            >
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      {/* 移除 passkey */}
      <BModal open={!!removingPasskey} onClose={() => setRemovingPasskey(null)} title={t('ProfilePage.RemovePasskey')}>
        <form>
          <div className="d-grid">
            <p className="mb-3 ms-1">{t('ProfilePage.RemovePasskeyTip')}</p>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (removingPasskey) onRemovePasskey(removingPasskey.id);
                setRemovingPasskey(null);
              }}
            >
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      {/* 解绑 OAuth */}
      <BModal open={unlinking !== null} onClose={() => setUnlinking(null)} title={t('ProfilePage.Unlink')}>
        <form>
          <div className="d-grid">
            <p className="mb-3 ms-1">{t('ProfilePage.UnlinkTip')}</p>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (unlinking !== null) onUnlink(unlinking);
                setUnlinking(null);
              }}
            >
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      {/* OAuth 绑定（回调进入） */}
      <BModal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} title={t('ProfilePage.Link')}>
        <form>
          <div className="d-grid">
            <p
              className="mb-3 ms-1"
              dangerouslySetInnerHTML={{
                __html: t('ProfilePage.LinkTip', {
                  type: linkType ? tokenTypes.get(linkType) : '',
                  email: linkEmail,
                }),
              }}
            />
            <div hidden={!totpEnabled}>
              <label htmlFor="link-totp" className="form-label small">
                {t('ProfilePage.TotpCode')}
              </label>
              <input
                type="text"
                className="form-control form-control-sm mb-3 w-100"
                id="link-totp"
                autoComplete="one-time-code"
                maxLength={11}
                value={linkTotpCode}
                onChange={(e) => setLinkTotpCode(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => doLink(totpEnabled ? linkTotpCode : undefined)}
            >
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>
    </div>
  );
}
