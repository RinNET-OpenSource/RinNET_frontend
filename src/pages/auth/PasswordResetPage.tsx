import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './auth.css';
import { resetPassword, getResetPasswordCode } from '@/lib/auth/auth';
import { tokenTypes } from '@/lib/auth/oauth';
import { StatusCode } from '@/lib/models';
import { notice } from '@/lib/message';

const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

interface AuthNavState {
  token?: string;
  type?: string;
  name?: string;
  username?: string;
  email?: string;
}

/** 等价旧版 password-reset.component */
export function PasswordResetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as AuthNavState | null;

  const [token, setToken] = useState<string | undefined>();
  const [type, setType] = useState<string | undefined>();
  const [oauthUsername, setOauthUsername] = useState<string | undefined>();
  const [oauthName, setOauthName] = useState<string | undefined>();

  const [email, setEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, verifyCode: false, password: false });
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state) {
      if (tokenTypes.has(state.type ?? '') && state.token?.length === 32) {
        setToken(state.token);
        setType(state.type);
      }
      if (state.email) setEmail(state.email);
      setOauthUsername(state.username);
      setOauthName(state.name);
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      timerRef.current = setInterval(() => setCooldown((n) => n - 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cooldown > 0]);

  const emailValid = EMAIL_PATTERN.test(email) && email.length <= 40;
  const codeValid = verifyCode.length === 8;
  const passwordValid = password.length >= 8 && password.length <= 100;

  async function sendCode() {
    if (!emailValid) {
      setTouched((t) => ({ ...t, email: true }));
      return;
    }
    try {
      const resp = await getResetPasswordCode(email);
      if (resp?.status) {
        const statusCode: number = resp.status.code;
        if (statusCode === StatusCode.OK) {
          notice(t('ResetPasswordPage.Messages.SendCodeSuccess'), 'success');
          setCooldown(60);
        } else if (statusCode === StatusCode.VERIFY_CODE_SEND_TOO_FAST) {
          notice(t('ResetPasswordPage.Messages.SendCodeTooFast'), 'warning');
        } else {
          notice(resp.status.message);
        }
      }
    } catch (error) {
      console.warn('get reset password code fail', error);
      notice(String(error));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid || !codeValid || !passwordValid) {
      setTouched({ email: true, verifyCode: true, password: true });
      return;
    }
    setSubmitting(true);
    try {
      const resp = await resetPassword(email, verifyCode, password);
      if (resp?.status) {
        const statusCode: number = resp.status.code;
        if (statusCode === StatusCode.OK) {
          navigateToSignIn();
        } else if (statusCode === StatusCode.VERIFY_CODE_NOT_CORRECT) {
          notice(t('ResetPasswordPage.Messages.CodeIncorrect'), 'danger');
        } else {
          notice(resp.status.message);
        }
      }
    } catch (error) {
      console.warn('reset password fail', error);
      notice(String(error));
    } finally {
      setSubmitting(false);
    }
  }

  function navigateToSignIn() {
    const navState: AuthNavState = {};
    if (emailValid) navState.email = email;
    if (token && type) {
      navState.token = token;
      navState.type = type;
    }
    navState.username = oauthUsername;
    navState.name = oauthName;
    void navigate('/sign-in', { state: navState });
  }

  return (
    <div className="d-flex justify-content-center">
      <div className="card authorization-card col-12 mb-5">
        <div className="pt-2 pt-lg-4 px-3 px-sm-5 mb-3">
          <div className="mb-4">
            <div className="fs-1 fw-bold">RinNET</div>
            <div className="fs-5 fw-bold">{t('ResetPasswordPage.Title')}</div>
          </div>
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="d-grid gap-1 small fw-bold mb-3">
              <div>
                <label htmlFor="email" className="form-label small">
                  {t('ResetPasswordPage.EmailAddress')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="email"
                    className={
                      'form-control form-control-sm' + (touched.email && !emailValid ? ' is-invalid' : '')
                    }
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((s) => ({ ...s, email: true }))}
                  />
                  {touched.email && !emailValid && (
                    <div className="invalid-tooltip d-block">
                      {!email ? (
                        <div>{t('ResetPasswordPage.EmailErrors.Required')}</div>
                      ) : email.length > 40 ? (
                        <div>{t('ResetPasswordPage.EmailErrors.Maxlength')}</div>
                      ) : (
                        <div>{t('ResetPasswordPage.EmailErrors.Email')}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="verifyCode" className="form-label small">
                  {t('ResetPasswordPage.VerificationCode')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="text"
                    className={
                      'form-control form-control-sm' + (touched.verifyCode && !codeValid ? ' is-invalid' : '')
                    }
                    id="verifyCode"
                    value={verifyCode}
                    maxLength={8}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    onBlur={() => setTouched((s) => ({ ...s, verifyCode: true }))}
                  />
                  {touched.verifyCode && !codeValid && (
                    <div className="invalid-tooltip d-block">
                      <div>{t('ResetPasswordPage.VerificationCodeErrors.Length')}</div>
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void sendCode()}
                    disabled={cooldown > 0}
                  >
                    {cooldown > 0 ? cooldown : t('ResetPasswordPage.Send')}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="password" className="form-label small">
                  {t('ResetPasswordPage.Password')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="password"
                    className={
                      'form-control form-control-sm' + (touched.password && !passwordValid ? ' is-invalid' : '')
                    }
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((s) => ({ ...s, password: true }))}
                  />
                  {touched.password && !passwordValid && (
                    <div className="invalid-tooltip d-block">
                      {!password ? (
                        <div>{t('ResetPasswordPage.PasswordErrors.Required')}</div>
                      ) : password.length < 8 ? (
                        <div>{t('ResetPasswordPage.PasswordErrors.Minlength')}</div>
                      ) : (
                        <div>{t('ResetPasswordPage.PasswordErrors.Maxlength')}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm mt-4 mb-2" disabled={submitting}>
                {t('ResetPasswordPage.Reset')}
              </button>
              <div className="fw-normal d-flex align-items-center justify-content-center">
                <button type="button" className="btn btn-link btn-sm text-decoration-none p-0" onClick={navigateToSignIn}>
                  {t('ResetPasswordPage.Back')}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
