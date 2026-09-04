import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './auth.css';
import { signUp, getVerifyCode, checkUsernameAvailability, checkEmailAvailability } from '@/lib/auth/auth';
import { tokenTypes, getSignInUrl } from '@/lib/auth/oauth';
import { currentEula, type EulaDocument } from '@/lib/auth/access';
import { StatusCode } from '@/lib/models';
import { notice } from '@/lib/message';

const EMAIL_PATTERN = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;

interface AuthNavState {
  token?: string;
  type?: string;
  name?: string;
  username?: string;
  email?: string;
}

/** 等价旧版 sign-up.component */
export function SignUpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? null) as AuthNavState | null;

  const [token, setToken] = useState<string | undefined>();
  const [type, setType] = useState<string | undefined>();

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptEula, setAcceptEula] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [eula, setEula] = useState<EulaDocument | null>(null);
  const [eulaHtml, setEulaHtml] = useState('');
  const [eulaLoading, setEulaLoading] = useState(true);
  const [eulaLoadError, setEulaLoadError] = useState(false);

  const providers = [...tokenTypes.keys()];

  const touch = (field: string) => setTouched((s) => ({ ...s, [field]: true }));
  const markAll = () => setTouched({ name: true, username: true, email: true, verifyCode: true, password: true, confirmPassword: true });

  useEffect(() => {
    if (state) {
      if (tokenTypes.has(state.type ?? '') && state.token?.length === 32) {
        setToken(state.token);
        setType(state.type);
      }
      if (state.name) setName(state.name);
      if (state.username) setUsername(state.username);
      if (state.email) setEmail(state.email);
      window.history.replaceState({}, document.title);
    }
    // 一次性注册邮箱预填（旧版 localStorage['email'] 流程）
    const storedEmail = localStorage.getItem('email');
    if (storedEmail) {
      localStorage.removeItem('email');
      setEmail(storedEmail);
      setEmailLocked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadEula();
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

  async function loadEula() {
    setEulaLoading(true);
    setEulaLoadError(false);
    try {
      const doc = await currentEula();
      setEula(doc);
      setEulaHtml(DOMPurify.sanitize(marked.parse(doc.content) as string));
    } catch {
      setEula(null);
      setEulaHtml('');
      setEulaLoadError(true);
    } finally {
      setEulaLoading(false);
    }
  }

  const nameValid = name.length >= 4 && name.length <= 40;
  const usernameValid = USERNAME_PATTERN.test(username) && username.length >= 3 && username.length <= 15;
  const emailValid = EMAIL_PATTERN.test(email) && email.length <= 40;
  const codeValid = verifyCode.length === 8;
  const passwordValid = password.length >= 8 && password.length <= 100;
  const confirmValid = confirmPassword === password && !(!passwordValid && password !== '');

  async function doCheckUsername() {
    if (!username) return;
    try {
      const resp = await checkUsernameAvailability(username);
      const statusCode = resp?.status?.code;
      if (statusCode === StatusCode.OK) notice(t('SignUpPage.Messages.UsernameAvailable'), 'success');
      else if (statusCode === StatusCode.USERNAME_ALREADY_TAKEN) notice(t('SignUpPage.Messages.UsernameAlreadyTaken'), 'danger');
      else notice(resp?.status?.message);
    } catch (error) {
      notice('Error checking username availability.');
      console.error('Error checking username', error);
    }
  }

  async function doCheckEmail() {
    if (!email) return;
    try {
      const resp = await checkEmailAvailability(email);
      const statusCode = resp?.status?.code;
      if (statusCode === StatusCode.OK) notice(t('SignUpPage.Messages.EmailAvailable'), 'success');
      else if (statusCode === StatusCode.EMAIL_ALREADY_IN_USE) notice(t('SignUpPage.Messages.EmailInvailable'), 'danger');
      else notice(resp?.status?.message);
    } catch (error) {
      notice('Error checking email availability.');
      console.error('Error checking email', error);
    }
  }

  async function sendCode() {
    if (!emailValid) {
      touch('email');
      return;
    }
    try {
      const resp = await getVerifyCode(email);
      const statusCode = resp?.status?.code;
      if (statusCode === StatusCode.OK) {
        notice(t('SignUpPage.Messages.SendCodeSuccess'), 'success');
        setCooldown(60);
      } else if (statusCode === StatusCode.EMAIL_ALREADY_IN_USE) {
        notice(t('SignUpPage.Messages.EmailInvailable'), 'danger');
      } else if (statusCode === StatusCode.VERIFY_CODE_SEND_TOO_FAST) {
        notice(t('SignUpPage.Messages.SendCodeTooFast'), 'warning');
      } else {
        notice(resp?.status?.message);
      }
    } catch (error) {
      console.warn('Send verify code fail.', error);
      notice(String(error));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!eula) {
      notice('协议尚未加载，请重新加载后再试。', 'warning');
      return;
    }
    if (!nameValid || !usernameValid || !emailValid || !codeValid || !passwordValid || !confirmValid || !acceptEula) {
      markAll();
      return;
    }
    setSubmitting(true);
    try {
      const resp = await signUp(name, username, email, verifyCode, password, token, eula.version);
      if (resp?.status) {
        const statusCode = resp.status.code;
        if (statusCode === StatusCode.OK) {
          notice('Sign up success.');
          window.location.reload();
        } else if (statusCode === StatusCode.EMAIL_ALREADY_IN_USE) {
          notice(t('SignUpPage.Messages.EmailInvailable'), 'danger');
        } else if (statusCode === StatusCode.USERNAME_ALREADY_TAKEN) {
          notice(t('SignUpPage.Messages.UsernameAlreadyTaken'), 'danger');
        } else if (statusCode === StatusCode.VERIFY_CODE_NOT_CORRECT) {
          notice(t('SignUpPage.Messages.CodeIncorrect'), 'danger');
        } else if (statusCode === StatusCode.EULA_VERSION_INVALID) {
          await loadEula();
          setAcceptEula(false);
          notice('协议已更新，请阅读并重新勾选同意。', 'warning');
        } else {
          notice(resp.status.message);
        }
      }
    } catch (error) {
      console.warn('Sign up failed.', error);
      notice(String(error));
    } finally {
      setSubmitting(false);
    }
  }

  function navigateToSignIn() {
    const navState: AuthNavState = {};
    if (emailValid) navState.email = email;
    if (usernameValid) navState.username = username;
    if (nameValid) navState.name = name;
    if (token && type) {
      navState.token = token;
      navState.type = type;
    }
    void navigate('/sign-in', { state: navState });
  }

  return (
    <div className="d-flex justify-content-center">
      <div className="card authorization-card col-12 mb-5">
        <div className="pt-2 pt-lg-4 px-3 px-sm-5 mb-3">
          <div className="mb-4">
            <div className="fs-1 fw-bold">RinNET</div>
            <div className="fs-5 fw-bold">{t('SignUpPage.Title')}</div>
          </div>
          {type && token && (
            <div className="callout callout-info py-3" role="alert">
              {t('SignUpPage.BindTip', { type: tokenTypes.get(type) })}
            </div>
          )}
          <form onSubmit={(e) => void onSubmit(e)}>
            <div className="d-grid gap-1 small fw-bold mb-3">
              <div className="position-relative">
                <label htmlFor="name" className="form-label small">
                  {t('SignUpPage.Nickname')}
                </label>
                <input
                  type="text"
                  className={'form-control form-control-sm' + (touched.name && !nameValid ? ' is-invalid' : '')}
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => touch('name')}
                />
                {touched.name && !nameValid && (
                  <div className="invalid-tooltip d-block">
                    {!name ? (
                      <div>{t('SignUpPage.NicknameErrors.Required')}</div>
                    ) : name.length < 4 ? (
                      <div>{t('SignUpPage.NicknameErrors.Minlength')}</div>
                    ) : (
                      <div>{t('SignUpPage.NicknameErrors.Maxlength')}</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="userName" className="form-label small">
                  {t('SignUpPage.Username')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="text"
                    className={'form-control form-control-sm' + (touched.username && !usernameValid ? ' is-invalid' : '')}
                    id="userName"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onBlur={() => touch('username')}
                  />
                  {touched.username && !usernameValid && (
                    <div className="invalid-tooltip d-block">
                      {!username ? (
                        <div>{t('SignUpPage.UsernameErrors.Required')}</div>
                      ) : username.length < 3 ? (
                        <div>{t('SignUpPage.UsernameErrors.Minlength')}</div>
                      ) : username.length > 15 ? (
                        <div>{t('SignUpPage.UsernameErrors.Maxlength')}</div>
                      ) : (
                        <div>{t('SignUpPage.UsernameErrors.Pattern')}</div>
                      )}
                    </div>
                  )}
                  <button className="input-group-btn btn btn-primary" type="button" onClick={() => void doCheckUsername()}>
                    {t('SignUpPage.Check')}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="email" className="form-label small">
                  {t('SignUpPage.EmailAddress')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="email"
                    className={'form-control form-control-sm' + (touched.email && !emailValid ? ' is-invalid' : '')}
                    id="email"
                    value={email}
                    disabled={emailLocked}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => touch('email')}
                  />
                  {touched.email && !emailValid && (
                    <div className="invalid-tooltip d-block">
                      {!email ? (
                        <div>{t('SignUpPage.EmailErrors.Required')}</div>
                      ) : email.length > 40 ? (
                        <div>{t('SignUpPage.EmailErrors.Maxlength')}</div>
                      ) : (
                        <div>{t('SignUpPage.EmailErrors.Email')}</div>
                      )}
                    </div>
                  )}
                  <button className="input-group-btn btn btn-primary" type="button" disabled={emailLocked} onClick={() => void doCheckEmail()}>
                    {t('SignUpPage.Check')}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="verifyCode" className="form-label small">
                  {t('SignUpPage.VerificationCode')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="text"
                    className={'form-control form-control-sm' + (touched.verifyCode && !codeValid ? ' is-invalid' : '')}
                    id="verifyCode"
                    value={verifyCode}
                    maxLength={8}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    onBlur={() => touch('verifyCode')}
                  />
                  {touched.verifyCode && !codeValid && (
                    <div className="invalid-tooltip d-block">
                      <div>{t('SignUpPage.VerificationCodeErrors.Length')}</div>
                    </div>
                  )}
                  <button className="input-group-btn btn btn-primary" type="button" onClick={() => void sendCode()} disabled={cooldown > 0}>
                    {cooldown > 0 ? cooldown : t('SignUpPage.Send')}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="password" className="form-label small">
                  {t('SignUpPage.Password')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="password"
                    className={'form-control form-control-sm' + (touched.password && !passwordValid ? ' is-invalid' : '')}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => touch('password')}
                  />
                  {touched.password && !passwordValid && (
                    <div className="invalid-tooltip d-block">
                      {!password ? (
                        <div>{t('SignUpPage.PasswordErrors.Required')}</div>
                      ) : password.length < 8 ? (
                        <div>{t('SignUpPage.PasswordErrors.Minlength')}</div>
                      ) : (
                        <div>{t('SignUpPage.PasswordErrors.Maxlength')}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className="form-label small">
                  {t('SignUpPage.ConfirmPassword')}
                </label>
                <div className="input-group input-group-sm has-validation">
                  <input
                    type="password"
                    className={
                      'form-control form-control-sm' +
                      (touched.confirmPassword && confirmPassword !== password && passwordValid ? ' is-invalid' : '')
                    }
                    id="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onBlur={() => touch('confirmPassword')}
                  />
                  {touched.confirmPassword && confirmPassword !== password && passwordValid && (
                    <div className="invalid-tooltip d-block">
                      <div>{t('SignUpPage.PasswordErrors.Confirm')}</div>
                    </div>
                  )}
                </div>
              </div>

              {eulaLoading ? (
                <div className="alert alert-secondary py-2 my-2 fw-normal" role="status">
                  正在加载最终用户许可协议…
                </div>
              ) : eulaLoadError ? (
                <div className="alert alert-danger py-2 my-2 fw-normal" role="alert">
                  <div>无法加载最终用户许可协议，暂时无法注册。</div>
                  <button className="btn btn-sm btn-outline-danger mt-2" type="button" onClick={() => void loadEula()}>
                    重新加载
                  </button>
                </div>
              ) : eula ? (
                <div className="border rounded p-2 my-2 fw-normal">
                  <div className="fw-bold">{eula.title}（版本 {eula.version}）</div>
                  <details className="my-2">
                    <summary className="text-primary">查看协议正文</summary>
                    <article className="p-2 small" dangerouslySetInnerHTML={{ __html: eulaHtml }} />
                  </details>
                  <label className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={acceptEula}
                      onChange={(e) => setAcceptEula(e.target.checked)}
                    />
                    <span className="form-check-label">我已阅读并同意当前版本的最终用户许可协议</span>
                  </label>
                </div>
              ) : null}
              <button
                type="submit"
                className="btn btn-primary btn-sm my-2"
                disabled={eulaLoading || eulaLoadError || submitting}
              >
                {t('SignUpPage.SignUp')}
              </button>
              <div className="fw-normal d-flex align-items-center justify-content-center">
                {t('SignUpPage.SignInTip')}
                <button type="button" className="btn btn-link btn-sm text-decoration-none p-0" onClick={navigateToSignIn}>
                  {t('SignUpPage.SignIn')}
                </button>
              </div>
              {(!type || !token) && (
                <>
                  <div className="row justify-content-center align-items-center m-0 mb-2">
                    <hr className="col m-0" />
                    <div className="col-auto">{t('SignInPage.Or')}</div>
                    <hr className="col m-0" />
                  </div>
                  {providers.map((provider) => (
                    <button type="button" key={provider} className="btn btn-theme" onClick={() => getSignInUrl(provider)}>
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
        </div>
      </div>
    </div>
  );
}
