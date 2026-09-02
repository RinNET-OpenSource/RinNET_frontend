import { Skeleton } from '@/components/ui/skeleton';

/** 迁移过渡用占位页（M2+ 逐页替换） */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="content">
      <h1 className="page-heading">{title}</h1>
      <p className="text-body-secondary">此页面尚未迁移到新版前端。</p>
      <Skeleton className="h-8 w-3/4" />
    </div>
  );
}
