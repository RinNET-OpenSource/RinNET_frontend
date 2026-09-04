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
    return [
      ...[1, 2, 3, 4, 5].map((value) => ({ label: String(value), value })),
      { label: '...', value: null },
      { label: String(totalPages), value: totalPages },
    ];
  }

  if (current >= totalPages - 3) {
    return [
      { label: '1', value: 1 },
      { label: '...', value: null },
      ...Array.from({ length: 5 }, (_, index) => {
        const value = totalPages - 4 + index;
        return { label: String(value), value };
      }),
    ];
  }

  return [
    { label: '1', value: 1 },
    { label: '...', value: null },
    { label: String(current - 1), value: current - 1 },
    { label: String(current), value: current },
    { label: String(current + 1), value: current + 1 },
    { label: '...', value: null },
    { label: String(totalPages), value: totalPages },
  ];
}

/** ngx-pagination-compatible control used by legacy Chunithm v2 pages. */
export function ChuniV2Pagination({
  current,
  listClassName = 'pagination pagination-sm justify-content-center m-0',
  pageSize,
  totalItems,
  onPageChange,
}: {
  current: number;
  listClassName?: string;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const normalizedCurrent = Math.min(Math.max(current, 1), totalPages);
  const pages = useMemo(
    () => pageEntries(normalizedCurrent, totalPages),
    [normalizedCurrent, totalPages],
  );

  return (
    <div className="user-select-none d-inline-block" style={{ cursor: 'default' }}>
      <ul className={listClassName}>
        <li className={`page-item${normalizedCurrent <= 1 ? ' disabled' : ''}`}>
          <a
            className="page-link"
            onClick={() => normalizedCurrent > 1 && onPageChange(normalizedCurrent - 1)}
          >
            &nbsp;&lt;&nbsp;
          </a>
        </li>
        {pages.map((page, index) => (
          <li
            className={`page-item${page.value === normalizedCurrent ? ' active' : ''}`}
            key={`${page.label}-${index}`}
          >
            <a
              className="page-link"
              onClick={() => page.value !== null && page.value !== normalizedCurrent && onPageChange(page.value)}
            >
              {page.label}
            </a>
          </li>
        ))}
        <li className={`page-item${normalizedCurrent >= totalPages ? ' disabled' : ''}`}>
          <a
            className="page-link"
            onClick={() => normalizedCurrent < totalPages && onPageChange(normalizedCurrent + 1)}
          >
            &nbsp;&gt;&nbsp;
          </a>
        </li>
      </ul>
    </div>
  );
}
