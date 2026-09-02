import { useMemo } from 'react';

/**
 * 等价旧版 pagination-template + ngx-pagination 的分页控件（.pagination 结构）。
 * 窗口大小 7（ngx maxSize 默认），当前页高亮，首尾禁用。
 */
export function Pagination({
  current,
  pageSize,
  totalItems,
  onPageChange,
  size = 'sm',
}: {
  current: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  size?: 'sm' | 'md';
}) {
  const totalPages = Math.ceil(totalItems / pageSize);

  const pages = useMemo(() => {
    const window = 7;
    let start = Math.max(1, current - Math.floor(window / 2));
    const end = Math.min(totalPages, start + window - 1);
    start = Math.max(1, end - window + 1);
    const list: Array<{ label: string; value: number }> = [];
    for (let i = start; i <= end; i++) list.push({ label: String(i), value: i });
    return list;
  }, [current, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <ul className={`pagination pagination${size === 'sm' ? '-sm' : ''} justify-content-center mb-2`}>
      <li className={'page-item' + (current <= 1 ? ' disabled' : '')}>
        <a className="page-link" onClick={() => current > 1 && onPageChange(current - 1)}>
          &nbsp;&lt;&nbsp;
        </a>
      </li>
      {pages.map((page) => (
        <li key={page.value} className={'page-item' + (current === page.value ? ' active' : '')}>
          <a className="page-link" onClick={() => current !== page.value && onPageChange(page.value)}>
            {page.label}
          </a>
        </li>
      ))}
      <li className={'page-item' + (current >= totalPages ? ' disabled' : '')}>
        <a className="page-link" onClick={() => current < totalPages && onPageChange(current + 1)}>
          &nbsp;&gt;&nbsp;
        </a>
      </li>
    </ul>
  );
}
