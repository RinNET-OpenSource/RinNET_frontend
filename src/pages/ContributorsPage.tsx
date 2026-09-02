import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './ContributorsPage.css';

interface Developer {
  id: number;
  name: string;
  link: string;
}

interface Sponsor {
  UserId: string;
  AvatarUrl: string;
  Name: string;
  SponsorshipCount: number;
  TotalMoney: number;
  Remarks: string;
  CurrentPlan?: string;
}

const developers: Developer[] = [
  { id: 20372033, name: 'HoshimiRin', link: 'https://github.com/mxihan' },
  { id: 29558475, name: 'Rinne', link: 'https://github.com/OharaRinneY' },
  { id: 35133371, name: 'Sanhei', link: 'https://github.com/Sanheiii' },
  { id: 88378875, name: 'TCPL', link: 'https://github.com/xuanxuan-0403' },
  { id: 105532072, name: '天梯Tyuikl', link: 'https://github.com/tyuikl32' },
];

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 等价旧版 contributors.component */
export function ContributorsPage() {
  const { t } = useTranslation();
  const [shuffledDevelopers] = useState(() => shuffle(developers));
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);

  useEffect(() => {
    const url =
      'https://ghproxy.sakuramoe.dev/https://raw.githubusercontent.com/mxihan/afdian-action/main/Sponsors.json';
    fetch(url)
      .then((r) => r.json())
      .then((resp) => {
        if (resp.SponsorsList) {
          const sorted = (resp.SponsorsList as Sponsor[]).sort((a, b) => {
            const totalMoneyA = a.CurrentPlan && a.CurrentPlan !== '' ? a.TotalMoney * 2 : a.TotalMoney;
            const totalMoneyB = b.CurrentPlan && b.CurrentPlan !== '' ? b.TotalMoney * 2 : b.TotalMoney;
            return totalMoneyB - totalMoneyA;
          });
          setSponsors(sorted);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="content">
      <h1 className="mb-4">{t('ContributorsPage.Title')}</h1>
      <div>
        <h2 className="mb-3">{t('ContributorsPage.Developers')}</h2>
        <div className="mb-4">
          {shuffledDevelopers.map((developer) => (
            <span key={developer.id} className="hstack d-inline-block me-3 mb-1">
              <a className="text-decoration-none" target="_blank" rel="noreferrer" href={developer.link}>
                <img className="avator me-1" src={`https://avatars.githubusercontent.com/u/${developer.id}`} alt="" />
                {developer.name}
              </a>
            </span>
          ))}
        </div>
        <h2 className="mb-3">{t('ContributorsPage.CDNProvider')}</h2>
        <div className="mb-4">
          <div className="hstack d-inline-block">
            <a className="text-decoration-none" target="_blank" rel="noreferrer" href="https://github.com/Steve0807">
              <img className="avator me-1" src="https://avatars.githubusercontent.com/u/104258961" alt="" />
              Steve0807
            </a>
          </div>
        </div>
        <h2 className="mb-3">{t('ContributorsPage.CommunityContributors')}</h2>
        <div className="mb-4 lh-lg">
          <span className="hstack d-inline-block me-3 mb-1">
            <a className="text-decoration-none" target="_blank" rel="noreferrer" href="https://github.com/XinJiDA">
              <img className="avator me-1" src="https://avatars.githubusercontent.com/u/78793632" alt="" />
              XinJiDA
            </a>
          </span>
          <span className="hstack d-inline-block me-3 mb-1">
            <a className="text-decoration-none" target="_blank" rel="noreferrer" href="https://github.com/DGCtanuki">
              <img className="avator me-1" src="https://avatars.githubusercontent.com/u/164617811" alt="" />
              DGCtanuki
            </a>
          </span>
          <span className="hstack d-inline-block me-3 mb-1">
            <a className="text-decoration-none" target="_blank" rel="noreferrer" href="https://github.com/qcsmallblack">
              <img className="avator me-1" src="https://avatars.githubusercontent.com/u/60247450" alt="" />
              Sherlock Ji
            </a>
          </span>
          <span className="hstack d-inline-block me-3 mb-1">
            <a className="text-decoration-none" target="_blank" rel="noreferrer" href="https://github.com/Eternal973">
              <img className="avator me-1" src="https://avatars.githubusercontent.com/u/51935482" alt="" />
              Eternal973
            </a>
          </span>
        </div>
        <h2 className="mb-3">{t('ContributorsPage.Donations')}</h2>
        <div className="mb-3 lh-lg">
          {sponsors.map((sponsor) => (
            <span
              key={sponsor.UserId}
              className={
                'hstack d-inline-block me-3 mb-1' +
                (sponsor.CurrentPlan && sponsor.CurrentPlan !== '' ? ' fw-bold' : '')
              }
            >
              <a
                className="text-decoration-none"
                target="_blank"
                rel="noreferrer"
                href={`https://afdian.com/u/${sponsor.UserId}`}
              >
                <img className="avator me-1" src={sponsor.AvatarUrl} alt="" />
                {sponsor.Name}
              </a>
            </span>
          ))}
        </div>
        <div className="mb-4">
          <a className="btn sponsor-me" target="_blank" rel="noreferrer" href="https://afdian.com/a/rinnet">
            {t('ContributorsPage.SponsorMe')}
          </a>
        </div>
        <h2 className="mb-3">{t('ContributorsPage.SpecialThanks')}</h2>
        <div className="mb-4">
          <div className="mb-3">{t('ContributorsPage.ThanksSamnyan')}</div>
          <div className="mb-3" dangerouslySetInnerHTML={{ __html: t('ContributorsPage.ThanksJetbrain') }} />
          <a href="https://www.jetbrains.com/webstorm/" target="_blank" rel="noreferrer">
            <img
              className="webstorm-logo bg-white"
              src="https://resources.jetbrains.com/storage/products/company/brand/logos/WebStorm.svg"
              alt=""
            />
          </a>
        </div>
      </div>
    </div>
  );
}
