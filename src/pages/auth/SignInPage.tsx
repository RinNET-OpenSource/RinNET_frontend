import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './auth.css';
import { login, loginWithTotp } from '@/lib/auth/auth';
import { tokenTypes, getSignInUrl } from '@/lib/auth/oauth';
import { webauthnLogin, isWebAuthnSupported, isWebAuthnAborted } from '@/lib/auth/webauthn';
import { StatusCode } from '@/lib/models';
import { notice } from '@/lib/message';

const TOTP_PATTERN = /^(\d{6}|[A-Za-z0-9]{5}-[A-Za-z0-9]{5})$/;
const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

interface AuthNavState {
  token?: string;
  type?: string;
  name?: string;
  username?: string;
  email?: string;
}

/** 等价旧版 sign-in.component */
export function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as AuthNavState | null;

  const [token] = useState<string | undefined>(() => {
    if (state && tokenTypes.has(state.type ?? '') && state.token?.length === 32) return state.token;
    return undefined;
  });
  const [type] = useState<string | undefined>(token ? state?.type : undefined);
  const [oauthName] = useState(state?.name);
  const [oauthUsername] = useState(state?.username);
  const [oauthEmail] = useState(state?.email);

  const [usernameOrEmail, setUsernameOrEmail] = useState(() => {
    if (!state) return '';
    if (state.email) return state.email;
    if (state.username) return state.username;
    return '';
  });
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ usernameOrEmail: false, password: false, code: false });
  const [totpToken, setTotpToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [passkeySigningIn, setPasskeySigningIn] = useState(false);

  const providers = [...tokenTypes.keys()];
  const webAuthnSupported = isWebAuthnSupported();

  // 等价旧版 history.replaceState 清掉 state（避免刷新重复消费）
  useState(() => {
    if (state) window.history.replaceState({}, document.title);
    return null;
  });

  const isEmail = (v: string) => EMAIL_PATTERN.test(v);

  function navigateToSignUp() {
    const navState: AuthNavState = {};
    if (usernameOrEmail) {
      if (isEmail(usernameOrEmail)) {
        navState.email = usernameOrEmail;
        navState.username = oauthUsername;
      } else {
        navState.username = usernameOrEmail;
        navState.email = oauthEmail;
      }
    } else {
      navState.username = oauthUsername;
      navState.email = oauthEmail;
    }
    if (token && type) {
      navState.token = token;
      navState.type = type;
    }
    navState.name = oauthName;
    void navigate('/sign-up', { state: navState });
  }

  function navigateToPasswordReset() {
    const navState: AuthNavState = {};
    if (usernameOrEmail && isEmail(usernameOrEmail)) {
      navState.email = usernameOrEmail;
    }
    if (token && type) {
      navState.token = token;
      navState.type = type;
    }
    navState.username = oauthUsername;
    navState.name = oauthName;
    void navigate('/password-reset', { state: navState });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      setTouched({ usernameOrEmail: true, password: true, code: false });
      return;
    }
    setSubmitting(true);
    try {
      const resp = await login(usernameOrEmail, password, token);
      if (resp?.status) {
        const statusCode: number = resp.status.code;
        if (statusCode === StatusCode.OK && resp.data) {
          notice(resp.status.message);
          window.location.reload();
        } else if (statusCode === StatusCode.TOTP_REQUIRED && resp.data?.totpToken) {
          setTotpToken(resp.data.totpToken);
        } else if (statusCode === StatusCode.LOGIN_FAILED) {
          notice(t('SignInPage.LoginFailedMessage'), 'danger');
        } else {
          notice(resp.status.message);
        }
      }
    } catch (error) {
      notice(String(error));
      console.warn('login fail', error);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmitTotp(e: React.FormEvent) {
    e.preventDefault();
    if (!TOTP_PATTERN.test(totpCode)) {
      setTouched((t) => ({ ...t, code: true }));
      return;
    }
    setSubmitting(true);
    try {
      const resp = await loginWithTotp(totpToken!, totpCode);
      const statusCode = resp?.status?.code;
      if (statusCode === StatusCode.OK && resp.data) {
        notice(resp.status.message);
        window.location.reload();
        return;
      }
      if (statusCode === StatusCode.TOTP_INVALID) {
        notice(t('SignInPage.TotpInvalidMessage'), 'danger');
      } else if (statusCode === StatusCode.TOTP_TOO_MANY_ATTEMPTS) {
        setTotpToken(null);
        notice(t('SignInPage.TotpLockedMessage'), 'danger');
      } else {
        setTotpToken(null);
        notice(resp?.status?.message);
      }
      setTotpCode('');
    } catch (error) {
      notice(String(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function signInWithPasskey() {
    if (passkeySigningIn) return;
    setPasskeySigningIn(true);
    try {
      const resp = await webauthnLogin();
      const statusCode = resp?.status?.code;
      if (statusCode === StatusCode.OK && resp.data) {
        notice(resp.status.message);
        window.location.reload();
        return;
      }
      notice(t('SignInPage.PasskeyFailedMessage'), 'danger');
    } catch (e) {
      if (!isWebAuthnAborted(e)) {
        console.warn('passkey login fail', e);
        notice(t('SignInPage.PasskeyFailedMessage'), 'danger');
      }
    } finally {
      setPasskeySigningIn(false);
    }
  }

  return (
    <div className="d-flex justify-content-center">
      <div className="card authorization-card col-12 mb-5">
        <div className="pt-2 pt-lg-4 px-3 px-sm-5 mb-3">
          <div className="mb-4">
            <div className="fs-1 fw-bold">RinNET</div>
            <div className="fs-5 fw-bold">{t('SignInPage.Title')}</div>
          </div>
          {type && token && (
            <div className="callout callout-info py-3" role="alert">
              {t('SignInPage.BindTip', { type: tokenTypes.get(type) })}
            </div>
          )}
          {totpToken ? (
            <form onSubmit={(e) => void onSubmitTotp(e)}>
              <div className="d-grid gap-1 small fw-bold">
                <p className="fw-normal">{t('SignInPage.TotpTip')}</p>
                <div className="position-relative">
                  <label htmlFor="totpCode" className="form-label small">
                    {t('SignInPage.TotpCode')}
                  </label>
                  <input
                    type="text"
                    className={
                      'form-control form-control-sm' +
                      (touched.code && !TOTP_PATTERN.test(totpCode) ? ' is-invalid' : '')
                    }
                    id="totpCode"
                    autoComplete="one-time-code"
                    maxLength={11}
                    autoFocus
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, code: true }))}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm mb-2" disabled={submitting}>
                  {t('SignInPage.SignIn')}
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-decoration-none"
                  onClick={() => {
                    setTotpToken(null);
                    setTotpCode('');
                  }}
                >
                  {t('SignInPage.TotpBack')}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={(e) => void onSubmit(e)}>
              <div className="d-grid gap-1 small fw-bold">
                <div className="position-relative">
                  <label htmlFor="usernameOrEmail" className="form-label small">
                    {t('SignInPage.UsernameOrEmail')}
                  </label>
                  <input
                    type="text"
                    className={
                      'form-control form-control-sm' +
                      (touched.usernameOrEmail && !usernameOrEmail ? ' is-invalid' : '')
                    }
                    id="usernameOrEmail"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, usernameOrEmail: true }))}
                  />
                </div>
                <div className="position-relative">
                  <label htmlFor="password" className="form-label small">
                    {t('SignInPage.Password')}
                  </label>
                  <input
                    type="password"
                    className={
                      'form-control form-control-sm' + (touched.password && !password ? ' is-invalid' : '')
                    }
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  />
                </div>
                <div className="text-end">
                  <button
                    type="button"
                    className="btn btn-link text-decoration-none btn-sm"
                    onClick={navigateToPasswordReset}
                  >
                    {t('SignInPage.ResetPasswordTip')}
                  </button>
                </div>
                <button type="submit" className="btn btn-primary btn-sm mb-2" disabled={submitting}>
                  {t('SignInPage.SignIn')}
                </button>
                <div className="fw-normal d-flex align-items-center justify-content-center">
                  {t('SignInPage.SignUpTip')}
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-decoration-none p-0"
                    onClick={navigateToSignUp}
                  >
                    {t('SignInPage.SignUp')}
                  </button>
                </div>
                {(!type || !token) && (
                  <>
                    <div className="row justify-content-center align-items-center m-0 mb-2">
                      <hr className="col m-0" />
                      <div className="col-auto">{t('SignInPage.Or')}</div>
                      <hr className="col m-0" />
                    </div>
                    {webAuthnSupported && (
                      <button
                        type="button"
                        className="btn btn-theme"
                        onClick={() => void signInWithPasskey()}
                        disabled={passkeySigningIn}
                      >
                        <svg className="oauth-icon" viewBox="0 0 16 16">
                          <use href="assets/passkey.svg#icon" />
                        </svg>
                        {t('SignInPage.SignInWithPasskey')}
                      </button>
                    )}
                    {providers.map((provider) => (
                      <button
                        type="button"
                        key={provider}
                        className="btn btn-theme"
                        onClick={() => getSignInUrl(provider)}
                      >
                        <svg className="oauth-icon" viewBox="0 0 16 16">
                          <use href={`assets/${provider}.svg#icon`} />
                        </svg>
                        {t('OAuth.ContinueWith', { type: tokenTypes.get(provider) })}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
