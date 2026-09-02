import './NotFoundPage.css';
import { assetsHost } from '@/lib/utils';

/** 等价旧版 not-found.component */
export function NotFoundPage() {
  return (
    <div className="not-found position-relative">
      <img className="not-found-img cannot-drag" src="/assets/not_found.webp" alt="" />
      <div className="turtle">
        <img
          className="ongekiHead cannot-drag"
          src={assetsHost + 'assets/chuni/avatar/CHU_UI_Avatar_Tex_06202201.webp'}
          alt=""
        />
        <svg className="not-found-turtle cannot-drag" viewBox="0 0 128 128">
          <g style={{ fill: '#e8daa9' }}>
            <use href="assets/turtle.svg#body" />
          </g>
          <g style={{ fill: '#efc75b' }}>
            <use href="assets/turtle.svg#shell" />
          </g>
          <g style={{ fill: '#f48a00' }}>
            <use href="assets/turtle.svg#lines" />
          </g>
          <use href="assets/turtle.svg#face" />
        </svg>
      </div>
    </div>
  );
}
