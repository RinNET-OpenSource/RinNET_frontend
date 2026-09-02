import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './EulaPage.css';
import { restoreAccess, currentEula, acceptEula, type EulaDocument } from '@/lib/auth/access';
import { logout } from '@/lib/auth/auth';
import { loadUser } from '@/lib/user';

/** 等价旧版 eula.component */
export function EulaPage() {
  const navigate = useNavigate();
  const [eula, setEula] = useState<EulaDocument | null>(null);
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [accepting, setAccepting] = useState(false);

  async function loadEulaDoc() {
    setLoadError(false);
    try {
      const doc = await currentEula();
      setEula(doc);
      setHtml(DOMPurify.sanitize(marked.parse(doc.content) as string));
    } catch {
      setEula(null);
      setHtml('');
      setLoadError(true);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const status = await restoreAccess();
        if (status?.banned) {
          void navigate('/banned');
          return;
        }
        if (!status?.eulaRequired) {
          void navigate('/dashboard');
          return;
        }
        await loadEulaDoc();
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function accept() {
    if (!eula) return;
    setAccepting(true);
    try {
      if (await acceptEula(eula.version)) {
        await loadUser(true);
        void navigate('/dashboard');
      } else {
        await loadEulaDoc();
      }
    } finally {
      setAccepting(false);
    }
  }

  function doLogout() {
    void logout().then(() => location.assign(''));
  }

  return (
    <main className="access-page container py-4">
      {loading ? (
        <div className="text-center py-5" role="status">
          正在加载最终用户许可协议…
        </div>
      ) : loadError ? (
        <div className="alert alert-danger mx-auto" role="alert">
          <h1 className="h4">无法加载最终用户许可协议</h1>
          <p>请检查网络连接后重试。协议加载成功前无法继续使用网页服务。</p>
          <button
            className="btn btn-outline-danger"
            type="button"
            onClick={() => {
              setLoading(true);
              void loadEulaDoc().finally(() => setLoading(false));
            }}
          >
            重新加载
          </button>
        </div>
      ) : eula ? (
        <div className="card shadow-sm mx-auto">
          <div className="card-body p-4">
            <h1>{eula.title}</h1>
            <p className="text-secondary">版本 {eula.version} · 发布于 {formatDate(eula.publishedAt)}</p>
            <article className="eula-content" dangerouslySetInnerHTML={{ __html: html }} />
            <div className="d-flex gap-2 mt-4 eula-actions">
              <button className="btn btn-primary" disabled={accepting} onClick={() => void accept()}>
                同意并继续
              </button>
              <button className="btn btn-outline-secondary" onClick={doLogout}>
                退出登录
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
