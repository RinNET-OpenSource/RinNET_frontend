# RinNET Portal（revived）

RinNET 门户前端重写版：**React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui**。
第一阶段目标：与旧版 Angular 实现（见 master 分支 / 主 worktree）功能与观感 1:1 等价，用户无感切换。

## 本地开发环境

域名必须与生产一致（OAuth 回调 / CDN referer 依赖），首次配置：

1. **hosts**：把 `127.0.0.1 portal.naominet.live` 加入 `C:\Windows\System32\drivers\etc\hosts`
   （Windows 11 24H2+ 会拦截脚本写入，推荐用 PowerToys 的 Hosts File Editor 编辑）。
2. **证书**：`npm run gen:cert` 生成自签证书（SAN 含 portal.naominet.live / localhost / 127.0.0.1），
   然后 `certutil -addstore -user Root ssl\portal.naominet.live.crt` 导入信任。
3. `npm install`
4. `npm run dev` → <https://portal.naominet.live>

后端通过 Vite 代理（同源拓扑，与生产一致）：

- `/api` → `http://aqua.naominet.live`（**正式服，只读使用**，写操作仅限测试账号自身资源）
- `/Maimai2Servlet` → 同上（maimai2 头像上传走原始 servlet 路径）

## 兼容性约定（用户无感切换）

与旧版共享的存储（键名/结构完全一致）：

- `localStorage`：`currentAccount`、`currentUser`、`colorTheme`、`lang`、`dbVersion`、`oauth_state`、`chusanMusicDb`
- `sessionStorage`（iframe 夺舍）：`impersonatedAccount`
- `IndexedDB`：库 `Aqua` v6，16 个 object store（游戏静态数据缓存）
- 主题属性：`<html data-bs-theme="dark|light">`（Bootstrap 5.3 观感 = 第一套主题）

## 目录

```
src/
  app.tsx            # 应用入口（providers + 路由）
  styles/globals.css # 主题令牌（--bs-* 重建 + shadcn 桥接）+ 旧版全局样式移植
  lib/               # api / auth / db / i18n / theme 等基础设施
  components/        # ui（shadcn）+ shell（外壳）+ shared（共享组件）
  features/          # 按功能域：ongeki / chuni / mai2 / admin ...
  pages/             # 路由页面组件
```

## 许可证

本项目采用 GNU Affero General Public License v3.0 或更高版本（AGPL-3.0-or-later）授权。
完整许可条款见 [LICENSE](LICENSE)。
