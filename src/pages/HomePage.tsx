import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './HomePage.css';
import { accountStore } from '@/lib/auth/account';
import { useStore } from '@/lib/store';
import { assetsHost } from '@/lib/utils';

const avatarHeadData = [
  { id: '06202101', color: ['#f2bfc6', '#ea81b6', '#bf0477'] }, // Akari
  { id: '06202201', color: ['#e8daa9', '#efc75b', '#f48a00'] }, // Yuzu
  { id: '06202301', color: ['#7d7d92', '#2e2f31', '#86a1d7'] }, // Aoi
  { id: '06202901', color: ['#fdfce8', '#66bb66', '#a0d086'] }, // Koboshi
  { id: '06203001', color: ['#fdebdf', '#ced1d9', '#c4e9f4'] }, // Saki
  { id: '06202501', color: ['#fe99e1', '#434343', '#7dc8d6'] }, // Riku
  { id: '06202601', color: ['#90b9b1', '#373737', '#b85366'] }, // Tsubaki
  { id: '06202401', color: ['#9d99bc', '#1d1f1e', '#4c4d4f'] }, // Rio
  { id: '06202801', color: ['#f7c274', '#9161aa', '#554f5b'] }, // Ayaka
  { id: '06202701', color: ['#fcecd3', '#ffffff', '#fad0d1'] }, // Haruna
  { id: '06203101', color: ['#7d7e81', '#4b4b6f', '#ffffff'] }, // Kaede
  { id: '06203201', color: ['#cf4d67', '#535154', '#eecb78'] }, // Akane
  { id: '06203301', color: ['#fdeada', '#aedef8', '#587ebc'] }, // Arisu
  { id: '06203401', color: ['#e9c98b', '#ffffff', '#f5afca'] }, // Mia
  { id: '06203501', color: ['#ed817b', '#e05663', '#f4e683'] }, // Chinatsu
  { id: '06203601', color: ['#f0948f', '#444547', '#4e96a4'] }, // Tsumugi
  { id: '06203701', color: ['#bea9f2', '#444444', '#f8f8f8'] }, // Setsuna
  { id: '06205001', color: ['#f0dae6', '#e07bcd', '#ffd1ff'] }, // Myimu
  { id: 'Custom_00000001', color: ['#ffe0f2', '#422c42', '#e451b5'] }, // Myimu - 古き終焉の奏者
  { id: 'Custom_00000002', color: ['#8ca460', '#605a65', '#454b22'] }, // Miliam
  { id: 'Custom_00000003', color: ['#655e84', '#525152', '#e41075'] },
];

/** 等价旧版 home.component（乌龟故障彩蛋 + 游戏支持列表） */
export function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const account = useStore(accountStore);
  const [logoIsShow, setLogoIsShow] = useState(true);
  const [avatarHead] = useState(() => avatarHeadData[Math.floor(Math.random() * avatarHeadData.length)]);
  const logoRefs = useRef<Array<HTMLElement | null>>([]);
  const faultTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  function fault() {
    if (faultTimer.current) clearInterval(faultTimer.current);
    if (!logoIsShow) return;
    faultTimer.current = setInterval(() => {
      for (const el of logoRefs.current) {
        if (!el) continue;
        el.style.transform = `translate(${Math.random() * 60 - 30}%, ${Math.random() * 60 - 30}%)`;
        el.classList.add('logo-img_fault');
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const h = Math.random() * 50 + 50;
        const w = Math.random() * 40 + 10;
        el.style.clipPath = `polygon(${x}% ${y}%, ${x + w}% ${y}%, ${x + w}% ${y + h}%, ${x}% ${y + h}%)`;
      }
    }, 30);
    setTimeout(() => faultStop(), 3000);
  }

  function faultStop() {
    if (faultTimer.current) clearInterval(faultTimer.current);
    for (const el of logoRefs.current) {
      if (!el) continue;
      el.classList.remove('logo-img_fault');
      el.style.transform = '';
      el.style.clipPath = '';
    }
    setLogoIsShow(false);
  }

  return (
    <div className="container-xxl p-0">
      <div className="pt-3 px-0 px-sm-3">
        <div className="row flex-sm-row-reverse justify-content-center">
          <div className="logo-container col-sm position-relative">
            <div
              ref={(el) => {
                logoRefs.current[0] = el;
              }}
              className={'logo-box' + (logoIsShow ? ' logo-bg' : '')}
              onClick={fault}
            >
              {logoIsShow && <img className="logo cannot-drag" src={assetsHost + 'assets/turtle.svg'} alt="turtle" />}
              {!logoIsShow && (
                <svg className="logo" viewBox="0 0 128 128">
                  <g style={{ fill: avatarHead.color[0] }}>
                    <use href="assets/turtle.svg#body" />
                  </g>
                  <g style={{ fill: avatarHead.color[1] }}>
                    <use href="assets/turtle.svg#shell" />
                  </g>
                  <g style={{ fill: avatarHead.color[2] }}>
                    <use href="assets/turtle.svg#lines" />
                  </g>
                  <use href="assets/turtle.svg#face" />
                </svg>
              )}
              {!logoIsShow && (
                <img
                  className="ongekiHead cannot-drag"
                  src={assetsHost + `assets/chuni/avatar/CHU_UI_Avatar_Tex_${avatarHead.id}.webp`}
                  alt=""
                />
              )}
            </div>
            <div
              ref={(el) => {
                logoRefs.current[1] = el;
              }}
              className="h-100 w-100 position-absolute"
            >
              {logoIsShow && (
                <img
                  className="logo cannot-drag"
                  src={assetsHost + 'assets/turtle.svg'}
                  alt="turtle"
                  onClick={fault}
                />
              )}
            </div>
          </div>
          <div className="col-12 col-sm-6">
            <div className="text-center text-sm-start mb-0">
              <h1 className="display-1 fw-semibold">RinNET</h1>
            </div>
            <div className="text-center text-sm-start mb-3">
              <h2 className="lead text-secondary">{t('HomePage.Description')}</h2>
            </div>
            <div className="text-center text-sm-start mb-3">
              {account ? (
                <button className="btn btn-primary col-12 col-sm-auto" onClick={() => navigate('/dashboard')}>
                  {t('HomePage.Dashboard')}
                </button>
              ) : (
                <button className="btn btn-primary col-12 col-sm-auto" onClick={() => navigate('/sign-in')}>
                  {t('HomePage.SignIn')}
                </button>
              )}
            </div>
          </div>
        </div>
        <hr />
        <div className="mb-5">
          <h2 className="mb-3 ps-0 fw-bold">{t('HomePage.Connect')}</h2>
          <p dangerouslySetInnerHTML={{ __html: t('HomePage.EditSegatools') }} />
          <div className="card align-middle bg-body-tertiary">
            <div className="card-body">
              <pre className="m-0" style={{ textWrap: 'inherit' }}>
                <code data-lang="ini">[DNS]
            default = aqua.naominet.live</code>
              </pre>
            </div>
          </div>
        </div>
        <h2 className="mb-3 ps-0 fw-bold">{t('HomePage.SupportedGames')}</h2>
        <p>{t('HomePage.SupportedGamesDesc')}</p>
        <ul className="row mb-5 px-3">
          <div className="col-12 col-lg-6">
            <li className="mb-3 ps-0 fw-bold">{t('HomePage.FullSupport')}</li>
            <p>{t('HomePage.FullSupportDesc')}</p>
            <ul className="list-group list-group-flush mb-3">
              <li className="list-group-item game-item">
                O.N.G.E.K.I.
                <span className="badge bg-primary rounded-pill">Re:Fresh</span>
              </li>
              <li className="list-group-item game-item">
                CHUNITHM NEW
                <span className="badge bg-primary rounded-pill">Verse</span>
              </li>
              <li className="list-group-item game-item">
                Maimai DX
                <span className="badge bg-primary rounded-pill">Prism Plus</span>
              </li>
            </ul>
          </div>
          <div className="col-12 col-lg-6">
            <li className="mb-3 ps-0 fw-bold">{t('HomePage.LimitedSupport')}</li>
            <p>{t('HomePage.LimitedSupportDesc')}</p>
            <ul className="list-group list-group-flush mb-3">
              <li className="list-group-item game-item">
                Card Maker
                <span className="badge bg-primary rounded-pill">1.39</span>
              </li>
              <li className="list-group-item game-item">
                CHUNITHM
                <span className="badge bg-primary rounded-pill">Paradise Lost</span>
              </li>
              <li className="list-group-item game-item">
                Project DIVA Arcade
                <span className="badge bg-primary rounded-pill">Future Tone</span>
              </li>
            </ul>
          </div>
        </ul>
      </div>
    </div>
  );
}
