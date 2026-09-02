import { loadingStore } from '@/lib/api/client';
import { useStore } from '@/lib/store';

/** 等价旧版顶部双层不定进度条（任一 HTTP 请求进行中时显示） */
export function LoadingBar() {
  const loading = useStore(loadingStore);
  if (!loading) return null;
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
