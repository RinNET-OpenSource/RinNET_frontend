import { useTranslation } from 'react-i18next';
import { LiquidAlert, LiquidButton, LiquidSurface } from '@liquefy-ui/react';
import { useId, useRef, type RefObject } from 'react';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { useTheme } from '@/lib/theme';

function uploadDocument(file: File, path: string, type: string) {
  const fileReader = new FileReader();
  fileReader.onload = () => {
    try {
      const j = JSON.parse(fileReader.result!.toString());
      if (j.gameId === type) {
        void api
          .post(path, j)
          .then(() => notice('OK'))
          .catch((error) => notice(String(error)));
      } else {
        notice('Wrong Game ID, please check you have select the correct file.');
      }
    } catch (e) {
      console.log(e);
      notice('Wrong Game ID, please check you have select the correct file.');
    }
  };
  fileReader.readAsText(file);
  notice('Uploading...');
}

function ImportWarning() {
  const { t } = useTranslation();
  const { family } = useTheme();

  if (family === 'liquefy') {
    return (
      <LiquidAlert className="liquefy-import-warning my-4" severity="warning">
        <strong>{t('ImportPage.WarningTitle')}</strong>
        <span className="ms-2">{t('ImportPage.WarningContent')}</span>
      </LiquidAlert>
    );
  }

  return (
    <div className="card my-3">
      <div className="card-header">{t('ImportPage.WarningTitle')}</div>
      <div className="card-body">{t('ImportPage.WarningContent')}</div>
    </div>
  );
}

function ImportPanel({
  inputRef,
  path,
  title,
  type,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  path: string;
  title: string;
  type: string;
}) {
  const { t } = useTranslation();
  const { family } = useTheme();
  const inputId = useId();
  const onFileChange = (file?: File) => {
    if (file) uploadDocument(file, path, type);
    if (inputRef.current) inputRef.current.value = '';
  };
  const input = (
    <input
      id={inputId}
      ref={inputRef}
      accept=".json"
      className={family === 'liquefy' ? 'visually-hidden' : 'form-control'}
      type="file"
      onChange={(event) => onFileChange(event.target.files?.[0])}
    />
  );

  if (family === 'liquefy') {
    return (
      <LiquidSurface className="liquefy-import-panel my-4" interactive={false} lens>
        <div className="liquefy-import-panel__meta">
          <h2 className="liquefy-import-panel__title">{title}</h2>
          <p className="liquefy-import-panel__hint">{t('ImportPage.FileHint')}</p>
        </div>
        {input}
        <LiquidButton type="button" onClick={() => inputRef.current?.click()}>
          {t('ImportPage.SelectFile')}
        </LiquidButton>
      </LiquidSurface>
    );
  }

  return (
    <div className="card my-3">
      <div className="card-header">{title}</div>
      <div className="card-body">{input}</div>
    </div>
  );
}

/** 等价旧版 importer.component */
export function ImporterPage() {
  const { t } = useTranslation();
  const ongekiRef = useRef<HTMLInputElement>(null);
  const chusanRef = useRef<HTMLInputElement>(null);
  const mai2Ref = useRef<HTMLInputElement>(null);

  return (
    <div className="content">
      <h1 className="page-heading">{t('ImportPage.Title')}</h1>
      <ImportWarning />
      <ImportPanel
        inputRef={ongekiRef}
        path="api/game/ongeki/import"
        title={t('Common.Ongeki')}
        type="SDDT"
      />
      <ImportPanel
        inputRef={chusanRef}
        path="api/game/chuni/v2/import"
        title={t('Common.ChuniV2')}
        type="SDHD"
      />
      <ImportPanel
        inputRef={mai2Ref}
        path="api/game/maimai2/import"
        title={t('Common.Mai2')}
        type="SDEZ"
      />
    </div>
  );
}
