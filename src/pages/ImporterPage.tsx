import { useTranslation } from 'react-i18next';
import { useRef } from 'react';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';

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

/** 等价旧版 importer.component */
export function ImporterPage() {
  const { t } = useTranslation();
  const ongekiRef = useRef<HTMLInputElement>(null);
  const chusanRef = useRef<HTMLInputElement>(null);
  const mai2Ref = useRef<HTMLInputElement>(null);

  return (
    <div className="content">
      <h1 className="page-heading">{t('ImportPage.Title')}</h1>

      <div className="card my-3">
        <div className="card-header">{t('ImportPage.WarningTitle')}</div>
        <div className="card-body">{t('ImportPage.WarningContent')}</div>
      </div>

      <div className="card my-3">
        <div className="card-header">{t('Common.Ongeki')}</div>
        <div className="card-body">
          <input
            ref={ongekiRef}
            accept=".json"
            className="form-control"
            type="file"
            onChange={(e) => {
              if (e.target.files?.[0]) uploadDocument(e.target.files[0], 'api/game/ongeki/import', 'SDDT');
              if (ongekiRef.current) ongekiRef.current.value = '';
            }}
          />
        </div>
      </div>

      <div className="card my-3">
        <div className="card-header">{t('Common.ChuniV2')}</div>
        <div className="card-body">
          <input
            ref={chusanRef}
            accept=".json"
            className="form-control"
            type="file"
            onChange={(e) => {
              if (e.target.files?.[0]) uploadDocument(e.target.files[0], 'api/game/chuni/v2/import', 'SDHD');
              if (chusanRef.current) chusanRef.current.value = '';
            }}
          />
        </div>
      </div>

      <div className="card my-3">
        <div className="card-header">{t('Common.Mai2')}</div>
        <div className="card-body">
          <input
            ref={mai2Ref}
            accept=".json"
            className="form-control"
            type="file"
            onChange={(e) => {
              if (e.target.files?.[0]) uploadDocument(e.target.files[0], 'api/game/maimai2/import', 'SDEZ');
              if (mai2Ref.current) mai2Ref.current.value = '';
            }}
          />
        </div>
      </div>
    </div>
  );
}
