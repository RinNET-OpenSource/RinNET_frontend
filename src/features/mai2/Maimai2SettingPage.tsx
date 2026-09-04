import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { api, rawFetch } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import type { DisplayMaimai2Profile } from './models';
import './Maimai2SettingPage.css';

const PACKET_LENGTH = 10_240;

async function centerSquareJpeg(file: File): Promise<Blob> {
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Unable to read image'));
      image.src = url;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      side,
      side,
    );
    const qualities = [0.92, 0.75, 0.55];
    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob) return blob;
    }
    throw new Error('Unable to crop image');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function PortraitDialog({
  aimeId,
  divMaxLength,
  onClose,
  open,
}: {
  aimeId: string;
  divMaxLength: number;
  onClose: () => void;
  open: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.click(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const upload = async () => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const blob = await centerSquareJpeg(file);
      if (blob.size > divMaxLength * PACKET_LENGTH) {
        notice('Upload file size is too large.');
        return;
      }
      const buffer = await blob.arrayBuffer();
      const divLength = Math.floor(buffer.byteLength / PACKET_LENGTH) + 1;
      let offset = 0;
      let divNumber = 0;
      while (offset < buffer.byteLength) {
        const readLength = Math.min(PACKET_LENGTH, buffer.byteLength - offset);
        const bytes = new Uint8Array(buffer.slice(offset, offset + readLength));
        let binary = '';
        for (const byte of bytes) binary += String.fromCharCode(byte);
        const payload = {
          userPortrait: {
            userId: aimeId,
            divLength,
            divNumber,
            divData: btoa(binary),
            placeId: 291,
            clientId: 'A63E01A2857',
            uploadDate: new Date().toISOString(),
            fileName: `${aimeId}.jpg`,
          },
        };
        const response = await rawFetch('/Maimai2Servlet/A63E01C2948/1.40/UploadUserPortraitApi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok || result?.returnCode !== 1) throw new Error('File size is too large');
        offset += readLength;
        divNumber += 1;
      }
      notice('Change user portrait successfully.');
      onClose();
    } catch (error) {
      notice(`Change user portrait failed: ${String(error)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="maimai2-portrait-dialog max-h-[85vh] max-w-lg gap-0 overflow-hidden border border-[var(--bs-border-color)] bg-[var(--bs-body-bg)] p-0 shadow-[var(--bs-box-shadow-lg)]"
      >
        <div className="modal-header">
          <h4 className="modal-title">Change User Portrait</h4>
          <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
        </div>
        <div className="modal-body overflow-y-auto">
          <div className="d-grid mb-3">
            <div hidden>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <div>{preview && <img className="portrait-preview img-fluid" src={preview} alt="" />}</div>
          </div>
          <button className="btn btn-primary btn-sm" disabled={!file || uploading} onClick={() => void upload()}>
            {t('Common.OK')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Equivalent to the legacy Maimai DX settings component. */
export function Maimai2SettingPage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<DisplayMaimai2Profile | null>(null);
  const [aimeId, setAimeId] = useState('');
  const [userName, setUserName] = useState('');
  const [userNameTouched, setUserNameTouched] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemTouched, setRedeemTouched] = useState(false);
  const [divMaxLength, setDivMaxLength] = useState(0);
  const [portraitOpen, setPortraitOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        await loadUser();
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        setAimeId(id);
        const [loadedProfile, maxLength] = await Promise.all([
          api.get('api/game/maimai2/profile', { aimeId: id }),
          api.get('api/game/maimai2/config/userPhoto/divMaxLength'),
        ]);
        setProfile(loadedProfile as DisplayMaimai2Profile);
        setUserName((loadedProfile as DisplayMaimai2Profile).userName);
        setDivMaxLength(Number(maxLength) || 0);
      } catch (error) {
        notice(String(error));
      }
    })();
  }, []);

  const changeUserName = async () => {
    if (!userNameTouched) return;
    try {
      const updated = await api.post('api/game/maimai2/profile/username', { aimeId: Number(aimeId), userName });
      setProfile(updated as DisplayMaimai2Profile);
      notice('Successfully changed');
    } catch (error) {
      notice(String(error));
    }
  };

  const activateRedeemCode = async () => {
    if (!redeemTouched) return;
    try {
      const result = await api.get('api/game/maimai2/redeem', { aimeId, redeemCode });
      notice(result?.status?.code === 92001 ? `Successfully activated ${result.data}` : String(result?.data));
    } catch (error) {
      notice(String(error));
    }
  };

  const downloadFile = async () => {
    try {
      const blob = await api.blob('api/game/maimai2/export', { aimeId });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `maimai2_${aimeId}_exported.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notice(String(error));
    }
  };

  return (
    <div className="content maimai2-setting-page">
      <h1 className="page-heading">{t('Maimai2.Setting.Title')}</h1>
      {profile && (
        <>
          <div className="card mb-3">
            <div className="card-header">{t('Maimai2.Setting.UserName')}</div>
            <div className="card-body">
              <h5 className="card-title">{t('Maimai2.Setting.UserNameTitle')}</h5>
              <form onSubmit={(event) => event.preventDefault()}>
                <input
                  value={userName}
                  onChange={(event) => { setUserName(event.target.value); setUserNameTouched(true); }}
                  type="text"
                  className="form-control mb-3"
                  id="username"
                />
              </form>
              <div className="d-flex justify-content-between align-items-center">
                <div className="text-muted small align-text-bottom">{t('Maimai2.Setting.UserNameSubTitle')}</div>
                <a className="btn btn-primary" onClick={() => void changeUserName()}>{t('Maimai2.Setting.UserNameChangeButton')}</a>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">{t('Maimai2.Setting.UserIcon')}</div>
            <div className="card-body">
              <h5 className="card-title" />
              <h5 className="card-text">
                {t('Maimai2.Setting.UserIconTips')}
                <ul>
                  <li>{t('Maimai2.Setting.UserIconLimit1')} &lt; <b>{divMaxLength * 10} kb</b>.</li>
                  <li>{t('Maimai2.Setting.UserIconLimit2')}</li>
                </ul>
              </h5>
              <div className="d-flex justify-content-between align-items-end">
                <div className="text-muted small align-text-bottom">{t('Maimai2.Setting.UserIconSubTitle')}</div>
                <a className="btn btn-primary" onClick={() => setPortraitOpen(true)}>{t('Maimai2.Setting.UserIconChangeButton')}</a>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header">{t('Maimai2.Setting.RedemptionCode')}</div>
            <div className="card-body">
              <h5 className="card-title">{t('Maimai2.Setting.RedemptionCodeTitle')}</h5>
              <form onSubmit={(event) => event.preventDefault()}>
                <input
                  value={redeemCode}
                  onChange={(event) => { setRedeemCode(event.target.value); setRedeemTouched(true); }}
                  type="text"
                  className="form-control mb-3"
                  id="redeemCode"
                />
              </form>
              <div className="d-flex justify-content-between align-items-center">
                <div className="text-muted small align-text-bottom">{t('Maimai2.Setting.RedemptionCodeSubTitle')}</div>
                <a className="btn btn-primary" onClick={() => void activateRedeemCode()}>{t('Maimai2.Setting.RedeemButton')}</a>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header text-danger">{t('Maimai2.Setting.ExportData')}</div>
            <div className="card-body">
              <h5 className="card-text">{t('Maimai2.Setting.ExportDataTitle')}</h5>
              <div className="d-flex justify-content-between align-items-end">
                <div className="text-muted small align-text-bottom">{t('Maimai2.Setting.ExportDataSubTitle')}</div>
                <a className="btn btn-primary" onClick={() => void downloadFile()}>{t('Maimai2.Setting.ExportDataSubButton')}</a>
              </div>
            </div>
          </div>
        </>
      )}

      <PortraitDialog
        aimeId={aimeId}
        divMaxLength={divMaxLength}
        open={portraitOpen}
        onClose={() => setPortraitOpen(false)}
      />
    </div>
  );
}
