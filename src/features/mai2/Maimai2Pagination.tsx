import { useMemo } from 'react';

type PageEntry = { label: string; value: number | null };

function pageEntries(current: number, totalPages: number): PageEntry[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({
      label: String(index + 1),
      value: index + 1,
    }));
  }

  if (current <= 4) {
    const leading: PageEntry[] = [1, 2, 3, 4, 5].map((value) => ({ label: String(value), value }));
    return leading.concat([
      { label: '…', value: null },
      { label: String(totalPages), value: totalPages },
    ]);
  }

  if (current >= totalPages - 3) {
    return [
      { label: '1', value: 1 },
      { label: '…', value: null },
      ...Array.from({ length: 5 }, (_, index) => {
        const value = totalPages - 4 + index;
        return { label: String(value), value };
      }),
    ];
  }

  return [
    { label: '1', value: 1 },
    { label: '…', value: null },
    { label: String(current - 1), value: current - 1 },
    { label: String(current), value: current },
    { label: String(current + 1), value: current + 1 },
    { label: '…', value: null },
    { label: String(totalPages), value: totalPages },
  ];
}

/** ngx-pagination-compatible compact control used by the legacy Maimai 2 pages. */
export function Maimai2Pagination({
  current,
  pageSize,
  totalItems,
  onPageChange,
}: {
  current: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const pages = useMemo(() => pageEntries(current, totalPages), [current, totalPages]);

  return (
    <ul className="pagination pagination-sm justify-content-center mb-2 user-select-none">
      <li className={`page-item${current <= 1 ? ' disabled' : ''}`}>
        <a className="page-link" onClick={() => current > 1 && onPageChange(current - 1)}>
          &nbsp;&lt;&nbsp;
        </a>
      </li>
      {pages.map((page, index) => (
        <li
          className={`page-item${page.value === current ? ' active' : ''}${page.value === null ? ' disabled' : ''}`}
          key={`${page.label}-${index}`}
        >
          <a className="page-link" onClick={() => page.value !== null && onPageChange(page.value)}>
            {page.label}
          </a>
        </li>
      ))}
      <li className={`page-item${current >= totalPages ? ' disabled' : ''}`}>
        <a className="page-link" onClick={() => current < totalPages && onPageChange(current + 1)}>
          &nbsp;&gt;&nbsp;
        </a>
      </li>
    </ul>
  );
}
