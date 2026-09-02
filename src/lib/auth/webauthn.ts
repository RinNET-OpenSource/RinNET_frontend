import { api } from '@/lib/api/client';
import { StatusCode } from '@/lib/models';
import { procLoginResp } from '@/lib/auth/auth';

/** 等价旧版 webauthn.service.ts（usernameless passkey 登录 + 注册管理） */

export function isWebAuthnSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
}

export async function webauthnLogin(): Promise<any> {
  const startResp = await api.get('api/auth/webauthn/startAuth');
  if (startResp?.status?.code !== StatusCode.OK || !startResp.data) {
    return startResp;
  }
  const requestId = startResp.data.requestId;
  const options = JSON.parse(startResp.data.credentialGetJson);
  const publicKey = options.publicKey;
  publicKey.challenge = base64UrlToUint8Array(publicKey.challenge);
  if (publicKey.allowCredentials) {
    publicKey.allowCredentials = publicKey.allowCredentials.map((c: any) => ({
      ...c,
      id: base64UrlToUint8Array(c.id),
    }));
  }

  const credential = (await navigator.credentials.get({ publicKey })) as PublicKeyCredential;
  const assertion = credential.response as AuthenticatorAssertionResponse;
  const credentialGetJson = JSON.stringify({
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: (credential as any).authenticatorAttachment ?? undefined,
    response: {
      authenticatorData: bufferToBase64Url(assertion.authenticatorData),
      clientDataJSON: bufferToBase64Url(assertion.clientDataJSON),
      signature: bufferToBase64Url(assertion.signature),
      userHandle: bufferToBase64Url(assertion.userHandle),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  });

  const finishResp = await api.post('api/auth/webauthn/finishAuth', { requestId, credentialGetJson });
  return procLoginResp(finishResp);
}

export async function webauthnRegister(nick: string, totpCode?: string): Promise<any> {
  const startResp = await api.post('api/user/webauthn/startRegister', totpCode ? { code: totpCode } : {});
  if (startResp?.status?.code !== StatusCode.OK || !startResp.data) {
    return startResp;
  }
  const options = JSON.parse(startResp.data);
  options.challenge = base64UrlToUint8Array(options.challenge);
  options.user.id = base64UrlToUint8Array(options.user.id);
  if (options.excludeCredentials) {
    options.excludeCredentials = options.excludeCredentials.map((c: any) => ({
      ...c,
      id: base64UrlToUint8Array(c.id),
    }));
  }

  const credential = (await navigator.credentials.create({ publicKey: options })) as PublicKeyCredential;
  const attestation = credential.response as AuthenticatorAttestationResponse;
  const credentialCreateJson = JSON.stringify({
    id: credential.id,
    rawId: bufferToBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: (credential as any).authenticatorAttachment ?? undefined,
    response: {
      clientDataJSON: bufferToBase64Url(attestation.clientDataJSON),
      attestationObject: bufferToBase64Url(attestation.attestationObject),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  });

  return api.post('api/user/webauthn/finishRegister', { nick, credentialCreateJson });
}

export function webauthnList(): Promise<any> {
  return api.get('api/user/webauthn');
}

export function webauthnRemove(id: number): Promise<any> {
  return api.delete(`api/user/webauthn/${id}`);
}

/** 用户取消/超时关闭了浏览器 passkey 弹窗 */
export function isWebAuthnAborted(e: unknown): boolean {
  return e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'AbortError');
}

function base64UrlToUint8Array(input: string): Uint8Array {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function bufferToBase64Url(buffer: ArrayBuffer | null): string | null {
  if (buffer === null) {
    return null;
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
