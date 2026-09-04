import { useEffect, useMemo } from 'react';

interface PageNumber {
  kind: 'page';
  label: string;
  value: number;
}

interface PageEllipsis {
  kind: 'ellipsis';
  label: '...';
  value: number;
}

type PageEntry = PageNumber | PageEllipsis;

function pageWindow(current: number, total: number): PageEntry[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => ({
      kind: 'page' as const,
      label: String(index + 1),
      value: index + 1,
    }));
  }

  if (current <= 4) {
    return [
      ...Array.from({ length: 5 }, (_, index) => ({
        kind: 'page' as const,
        label: String(index + 1),
        value: index + 1,
      })),
      { kind: 'ellipsis', label: '...', value: 6 },
      { kind: 'page', label: String(total), value: total },
    ];
  }

  if (current >= total - 3) {
    return [
      { kind: 'page', label: '1', value: 1 },
      { kind: 'ellipsis', label: '...', value: total - 5 },
      ...Array.from({ length: 5 }, (_, index) => {
        const value = total - 4 + index;
        return { kind: 'page' as const, label: String(value), value };
      }),
    ];
  }

  return [
    { kind: 'page', label: '1', value: 1 },
    { kind: 'ellipsis', label: '...', value: current - 2 },
    { kind: 'page', label: String(current - 1), value: current - 1 },
    { kind: 'page', label: String(current), value: current },
    { kind: 'page', label: String(current + 1), value: current + 1 },
    { kind: 'ellipsis', label: '...', value: current + 2 },
    { kind: 'page', label: String(total), value: total },
  ];
}

/** ngx-pagination-compatible layout used by the legacy Ongeki list pages. */
export function OngekiPagination({
  current,
  marginClassName = 'mb-2',
  pageSize,
  totalItems,
  onPageChange,
}: {
  current: number;
  marginClassName?: string;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const normalizedCurrent = Math.min(Math.max(current, 1), totalPages);
  const pages = useMemo(
    () => pageWindow(normalizedCurrent, totalPages),
    [normalizedCurrent, totalPages],
  );

  useEffect(() => {
    if (current !== normalizedCurrent) onPageChange(normalizedCurrent);
  }, [current, normalizedCurrent, onPageChange]);

  return (
    <div className="d-flex user-select-none" style={{ cursor: 'default' }}>
      <ul className={`pagination pagination-sm justify-content-center ${marginClassName}`}>
        <li className={'page-item' + (normalizedCurrent <= 1 ? ' disabled' : '')}>
          <a
            className="page-link"
            onClick={() => normalizedCurrent > 1 && onPageChange(normalizedCurrent - 1)}
          >
            &nbsp;&lt;&nbsp;
          </a>
        </li>
        {pages.map((page, index) => (
          <li
            className={'page-item' + (normalizedCurrent === page.value ? ' active' : '')}
            key={`${page.kind}-${page.value}-${index}`}
          >
            <a
              className="page-link"
              onClick={() =>
                normalizedCurrent !== page.value && onPageChange(page.value)
              }
            >
              {page.label}
            </a>
          </li>
        ))}
        <li className={'page-item' + (normalizedCurrent >= totalPages ? ' disabled' : '')}>
          <a
            className="page-link"
            onClick={() =>
              normalizedCurrent < totalPages && onPageChange(normalizedCurrent + 1)
            }
          >
            &nbsp;&gt;&nbsp;
          </a>
        </li>
      </ul>
    </div>
  );
}
