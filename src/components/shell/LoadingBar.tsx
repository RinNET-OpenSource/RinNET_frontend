import { loadingStore } from '@/lib/api/client';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';

/** 等价旧版顶部双层不定进度条（任一 HTTP 请求进行中时显示） */
export function LoadingBar({ inNavbar = false }: { inNavbar?: boolean }) {
  const loading = useStore(loadingStore);
  const theme = useTheme();

  if (!loading) return null;

  if (theme.family === 'liquefy') {
    if (!inNavbar) return null;
    return <span className="liquefy-user-spinner" role="status" aria-label="Loading" />;
  }

  return (
    <div>
      <div className="progress fixed-top" style={{ marginTop: '3.6rem' }}>
        <div className="progress-bar indeterminate-front" role="progressbar" />
      </div>
      <div className="progress fixed-top bg-transparent" style={{ marginTop: '3.6rem' }}>
        <div className="progress-bar indeterminate-back" role="progressbar" />
      </div>
    </div>
  );
}
