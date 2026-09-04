import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExclamationTriangleFill,
  Eye,
  EyeSlash,
  InfoCircleFill,
  PencilSquare,
  PlusSquareDotted,
  Trash,
} from 'react-bootstrap-icons';
import { BModal } from '@/components/shared/BModal';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { StatusCode, type Card, type CardExternal } from '@/lib/models';
import { loadUser, userStore } from '@/lib/user';
import { useStore } from '@/lib/store';

/** 等价旧版 Luid：11001111000000000000 掩码 */
class Luid {
  full: string;
  hidden = true;
  static mask = '11001111000000000000';

  constructor(value: string) {
    this.full = value;
  }

  get displayValue(): string {
    if (this.hidden) return this.getMaskedValue();
    return this.full;
  }

  private getMaskedValue(): string {
    let result = '';
    for (let i = 0; i < Luid.mask.length; i++) {
      const char = Luid.mask.at(i);
      if (char === '0') result += '*';
      else if (char === '1') result += this.full.at(i);
      else result += char as string;
    }
    return result;
  }
}

type ModalState =
  | { kind: 'none' }
  | { kind: 'bind' }
  | { kind: 'unbind'; card: Card }
  | { kind: 'change'; card: Card }
  | { kind: 'addAlias'; card: Card }
  | { kind: 'removeAlias'; external: CardExternal };

/** 等价旧版 cards.component */
export function CardsPage() {
  const { t } = useTranslation();
  const user = useStore(userStore);
  const [loaded, setLoaded] = useState(false);
  const [luidsHidden, setLuidsHidden] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  const [accessCode, setAccessCode] = useState('');

  useEffect(() => {
    void loadUser().then(() => setLoaded(true));
  }, []);

  const luids = useMemo(() => {
    const map = new Map<string, Luid>();
    user?.cards?.forEach((card) => {
      map.set(card.luid, new Luid(card.luid));
      card.cardExternalList?.forEach((cardExt) => {
        map.set(cardExt.luid, new Luid(cardExt.luid));
      });
    });
    // 掩码显隐状态由外部 Record 控制
    for (const l of map.values()) {
      l.hidden = luidsHidden[l.full] ?? true;
    }
    return map;
  }, [user, luidsHidden]);

  function toggleLuid(luid: Luid | undefined) {
    if (!luid) return;
    setLuidsHidden((s) => ({ ...s, [luid.full]: !luid.hidden }));
  }

  function reload() {
    void loadUser(true).then(() => setLoaded(true));
  }

  async function setDefault(card: Card) {
    try {
      const resp = await api.post('api/user/setDefaultCard', { extId: card.extId });
      if (resp?.status) {
        if (resp.status.code === StatusCode.OK) {
          reload();
          notice(t('CardsPage.SetDefaultSuccessMessage'), 'success');
        } else {
          notice(resp.status.message);
        }
      } else {
        notice('Set default card failed.');
      }
    } catch (error) {
      notice(String(error));
    }
  }

  async function onUnbindCard(card: Card) {
    try {
      const resp = await api.post('api/user/unbindCard/', { accessCode: card.luid });
      if (resp?.status) {
        if (resp.status.code === StatusCode.OK) reload();
        else notice(resp.status.message);
      } else notice('Unbind card failed.');
    } catch (error) {
      notice(String(error));
    }
    setModal({ kind: 'none' });
  }

  async function onRemoveExternal(external: CardExternal) {
    try {
      const resp = await api.delete('api/user/removeCardExternal', undefined, { accessCode: external.luid });
      if (resp?.status) {
        if (resp.status.code === StatusCode.OK) reload();
        else notice(resp.status.message);
      } else notice('Remove alias failed.');
    } catch (error) {
      notice(String(error));
    }
    setModal({ kind: 'none' });
  }

  async function onBindCard() {
    if (!accessCode) return;
    try {
      const resp = await api.post('api/user/bindCard/', { accessCode });
      if (resp?.status) {
        const statusCode: number = resp.status.code;
        if (statusCode === StatusCode.OK) {
          setAccessCode('');
          reload();
          notice(t('CardsPage.BindSuccessMessage'), 'success');
        } else if (statusCode === StatusCode.CARD_NOT_FOUND) {
          notice(t('CardsPage.CardNotFountMessage'), 'danger');
        } else if (statusCode === StatusCode.CARD_ALREADY_LINKED_BY_YOU) {
          notice(t('CardsPage.AlreadyBoundToSelfMessage'), 'warning');
        } else if (statusCode === StatusCode.CARD_ALREADY_LINKED_BY_OTHERS) {
          notice(t('CardsPage.AlreadyBoundToOthersMessage'), 'danger');
        } else {
          notice(resp.status.message);
        }
      } else notice('Bind card failed.');
    } catch (error) {
      notice(String(error));
    }
    setModal({ kind: 'none' });
  }

  async function onAddAccessCode(extId: number) {
    if (!accessCode) return;
    try {
      const resp = await api.post('api/user/addAccessCode/', { accessCode, extId });
      if (resp?.status) {
        const statusCode: number = resp.status.code;
        if (statusCode === StatusCode.OK) {
          setAccessCode('');
          reload();
        } else if (statusCode === StatusCode.ADD_ACCESS_CODE_ERROR) {
          notice(t('CardsPage.AddAliasErrorMessage'), 'danger');
        } else {
          notice(resp.status.message);
        }
      } else notice('Add alias failed.');
    } catch (error) {
      notice(String(error));
    }
    setModal({ kind: 'none' });
  }

  async function onChangeAccessCode(extId: number) {
    if (!accessCode) return;
    try {
      const resp = await api.post('api/user/changeProfileAccessCode/', { accessCode, extId });
      if (resp?.status) {
        const statusCode: number = resp.status.code;
        if (statusCode === StatusCode.OK) {
          setAccessCode('');
          reload();
          notice(t('CardsPage.ChangeAccessCodeSuccessMessage'), 'success');
        } else if (statusCode === StatusCode.CHANGE_ACCESS_CODE_ERROR) {
          notice(t('CardsPage.ChangeAccessCodeErrorMessage'), 'danger');
        } else {
          notice(resp.status.message);
        }
      } else notice('Change access code failed.');
    } catch (error) {
      notice(String(error));
    }
    setModal({ kind: 'none' });
  }

  const eyeToggle = (luid: Luid | undefined) => (
    <div
      className="ms-2 p-0 user-select-none cursor-pointer d-flex align-items-center"
      onClick={() => toggleLuid(luid)}
    >
      {luid?.hidden ? <Eye /> : <EyeSlash />}
    </div>
  );

  return (
    <div className="content">
      <h1 className="page-heading">{t('CardsPage.Title')}</h1>
      <div className="hstack alert alert-warning" role="alert">
        <ExclamationTriangleFill className="me-2" />
        <div>{t('CardsPage.Warning1')}</div>
      </div>
      {loaded && user?.cards && (
        <div className="row px-2 mb-3">
          {[...user.cards].sort((a, b) => a.id - b.id).map((card) => (
            <div className="col-lg-6 p-1" key={card.id}>
              <div className="card h-100">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <div className="float-start">No.{card.id}</div>
                  <div className="float-end">
                    <button className="btn btn-close" onClick={() => setModal({ kind: 'unbind', card })} />
                  </div>
                </div>
                <div className="card-body">
                  <div className="mb-2 fw-bold">
                    {t('CardsPage.AccessCode')}
                    {t('Common.Colon')}
                  </div>
                  <div className="mb-3 hstack">
                    <div className="font-monospace">{luids.get(card.luid)?.displayValue}</div>
                    {eyeToggle(luids.get(card.luid))}
                    <div
                      className="ms-2 p-0 user-select-none cursor-pointer d-flex align-items-center"
                      onClick={() => {
                        setAccessCode(card.luid);
                        setModal({ kind: 'change', card });
                      }}
                    >
                      <PencilSquare />
                    </div>
                  </div>
                  <div className="mb-2 fw-bold">
                    {t('CardsPage.Aliases')}
                    {t('Common.Colon')}
                  </div>
                  {card.cardExternalList.length === 0 && <div className="mb-2">{t('CardsPage.None')}</div>}
                  {card.cardExternalList.map((item) => (
                    <div className="mb-3 hstack" key={item.id}>
                      <div className="font-monospace align-middle">{luids.get(item.luid)?.displayValue}</div>
                      <div className="ms-2 p-0 align-middle user-select-none cursor-pointer d-flex align-items-center">
                        <span onClick={() => toggleLuid(luids.get(item.luid))}>
                          {luids.get(item.luid)?.hidden ? <Eye /> : <EyeSlash />}
                        </span>
                      </div>
                      <div
                        className="ms-2 p-0 align-middle user-select-none cursor-pointer d-flex align-items-center"
                        onClick={() => setModal({ kind: 'removeAlias', external: item })}
                      >
                        <Trash />
                      </div>
                    </div>
                  ))}
                  <div>
                    <a className="card-link cursor-pointer" onClick={() => setModal({ kind: 'addAlias', card })}>
                      {t('CardsPage.AddAlias')}
                    </a>
                  </div>
                </div>
                <div className="card-footer">
                  <button
                    className={'btn btn-link p-0' + (card.default ? ' disabled link-secondary' : '')}
                    onClick={() => !card.default && setDefault(card)}
                  >
                    {t('CardsPage.SetDefault')}
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="col p-1">
            <div className="card h-100 card-btn" onClick={() => setModal({ kind: 'bind' })}>
              <div className="card-body d-flex justify-content-center align-items-center fs-4 text-secondary user-select-none">
                <PlusSquareDotted className="me-2" />
                <div>{t('CardsPage.BindCard')}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="hstack alert alert-info" role="alert">
        <InfoCircleFill className="me-2" />
        <div>{t('CardsPage.Warning2')}</div>
      </div>
      <div className="hstack alert alert-info" role="alert">
        <InfoCircleFill className="me-2" />
        <div>{t('CardsPage.Warning3')}</div>
      </div>
      <div className="hstack alert alert-info" role="alert">
        <InfoCircleFill className="me-2" />
        <div>{t('CardsPage.Warning4')}</div>
      </div>

      <BModal
        open={modal.kind === 'bind'}
        onClose={() => setModal({ kind: 'none' })}
        title={t('CardsPage.BindCard')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onBindCard();
          }}
        >
          <div className="d-grid">
            <input
              type="text"
              className="form-control mb-3"
              value={accessCode}
              maxLength={20}
              placeholder={t('CardsPage.AccessCode')}
              onChange={(e) => setAccessCode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary btn-sm">
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>

      {modal.kind === 'unbind' && (
        <BModal open onClose={() => setModal({ kind: 'none' })} title={t('CardsPage.UnbindCard')}>
          <form>
            <div className="d-grid">
              <p className="mb-3 ms-1">{t('CardsPage.UnbindCardTip')}</p>
              <button className="btn btn-danger btn-sm" onClick={() => void onUnbindCard(modal.card)}>
                {t('Common.OK')}
              </button>
            </div>
          </form>
        </BModal>
      )}

      {modal.kind === 'change' && (
        <BModal open onClose={() => setModal({ kind: 'none' })} title={t('CardsPage.ChangeAccessCode')}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onChangeAccessCode(modal.card.extId);
            }}
          >
            <div className="d-grid">
              <input
                type="text"
                className="form-control mb-3"
                value={accessCode}
                placeholder={t('CardsPage.AccessCode')}
                onChange={(e) => setAccessCode(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                {t('Common.OK')}
              </button>
            </div>
          </form>
        </BModal>
      )}

      {modal.kind === 'addAlias' && (
        <BModal open onClose={() => setModal({ kind: 'none' })} title={t('CardsPage.AddAlias')}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onAddAccessCode(modal.card.extId);
            }}
          >
            <div className="d-grid">
              <input
                type="text"
                className="form-control mb-3"
                value={accessCode}
                maxLength={20}
                placeholder={t('CardsPage.AccessCode')}
                onChange={(e) => setAccessCode(e.target.value)}
              />
              <button type="submit" className="btn btn-primary btn-sm">
                {t('Common.OK')}
              </button>
            </div>
          </form>
        </BModal>
      )}

      {modal.kind === 'removeAlias' && (
        <BModal open onClose={() => setModal({ kind: 'none' })} title={t('CardsPage.RemoveAlias')}>
          <form>
            <div className="d-grid">
              <p className="mb-3 ms-1">{t('CardsPage.RemoveAliasTip')}</p>
              <button className="btn btn-danger btn-sm" onClick={() => void onRemoveExternal(modal.external)}>
                {t('Common.OK')}
              </button>
            </div>
          </form>
        </BModal>
      )}
    </div>
  );
}
