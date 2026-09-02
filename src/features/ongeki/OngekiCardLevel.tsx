import { assetsHost } from '@/lib/utils';
import './ongeki-common.css';

/** 等价旧版 ongeki-card-level.component（卡牌等级条） */
export function OngekiCardLevel({
  level,
  attribute,
  className,
}: {
  level: number;
  attribute: string;
  className?: string;
}) {
  return (
    <div
      className={'level-container ratio user-select-none' + (className ? ' ' + className : '')}
      style={{
        backgroundImage: `url(${assetsHost}assets/ongeki/gameUi/UI_CMN_CharaLevel_base.webp)`,
      }}
    >
      <div className="hstack w-100 align-items-center" style={{ paddingLeft: '6%' }}>
        <img
          className="h-75"
          src={assetsHost + `assets/ongeki/gameUi/UI_CMN_AttributeIcon_${attribute}_mini.webp`}
          alt=""
        />
        <img
          className="level-header"
          src={assetsHost + 'assets/ongeki/gameUi/UI_CMN_CharaLevel_base_Header.webp'}
          alt=""
        />
        {level >= 100 && (
          <img
            className="level-number"
            style={{ marginLeft: '-10%' }}
            src={assetsHost + `assets/ongeki/gameUi/UI_NUM_13pt_Charalevel_00/${Math.floor(level / 100)}.webp`}
            alt=""
          />
        )}
        {level >= 10 && (
          <img
            className="level-number"
            style={{ marginLeft: level >= 100 ? '-12%' : '-7%' }}
            src={
              assetsHost + `assets/ongeki/gameUi/UI_NUM_13pt_Charalevel_00/${Math.floor((level % 100) / 10)}.webp`
            }
            alt=""
          />
        )}
        <img
          style={{ marginLeft: level >= 10 ? '-10%' : '-5%' }}
          className="level-number"
          src={assetsHost + `assets/ongeki/gameUi/UI_NUM_13pt_Charalevel_00/${level % 10}.webp`}
          alt=""
        />
      </div>
    </div>
  );
}
