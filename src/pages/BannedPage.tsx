import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './BannedPage.css';
import { restoreAccess } from '@/lib/auth/access';
import { logout } from '@/lib/auth/auth';

/** 等价旧版 banned.component */
export function BannedPage() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const appealGroup = '295954906';

  useEffect(() => {
    void restoreAccess().then((status) => {
      if (!status?.banned) {
        void navigate(status?.eulaRequired ? '/eula' : '/dashboard');
      }
    });
  }, [navigate]);

  async function copy() {
    await navigator.clipboard.writeText(appealGroup);
    setCopied(true);
  }

  function doLogout() {
    void logout().then(() => location.assign(''));
  }

  return (
    <main className="ban-page d-flex align-items-center justify-content-center text-center p-4">
      <div>
        <div className="ban-title">YOU ARE BANNED</div>
        <div className="ban-title chinese">你被封禁了</div>
        <p className="lead mt-4">当前账号无法使用 RinNET 网页服务。</p>
        <p>如需申诉，请加入 QQ 群并联系群主：</p>
        <button className="btn btn-lg btn-outline-light appeal" onClick={() => void copy()}>
          {appealGroup} · {copied ? '已复制' : '复制群号'}
        </button>
        <div className="mt-4">
          <button className="btn btn-light" onClick={doLogout}>
            退出登录
          </button>
        </div>
      </div>
    </main>
  );
}
