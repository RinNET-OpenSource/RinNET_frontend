/** 供非 React 模块（api client 等）使用的路由导航桥，由 app.tsx 注入实现 */

type NavigateFn = (path: string) => void;

let navigateFn: NavigateFn | null = null;

export function setNavigator(fn: NavigateFn) {
  navigateFn = fn;
}

export function navigate(path: string) {
  navigateFn?.(path);
}
