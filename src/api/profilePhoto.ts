import { isNoPhotoBody, mediaType } from '../features/profile/profilePhoto';
import { authedFetch, getApiBaseUrl } from './client';

// The signed-in account's profile picture on the API (/api/profile-photo).
// The API takes the account from the token only, so no id is ever sent. Like
// every other call, a 401 here signs the user out (authedFetch).

// The picture is about 30-60 KB; a cold API can be slow.
const PHOTO_TIMEOUT_MS = 20_000;

function photoUrl(): URL {
  return new URL('/api/profile-photo', getApiBaseUrl());
}

export function putProfilePhoto(bytes: Uint8Array, timeoutMs: number = PHOTO_TIMEOUT_MS): Promise<void> {
  return authedFetch(
    'PUT /api/profile-photo',
    photoUrl(),
    { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: bytes as unknown as BodyInit },
    async () => undefined,
    timeoutMs
  );
}

// The account's picture (bytes), or null only for the API's exact "no picture"
// reply: status 200, application/json, body exactly {"photo":null}. Every
// other reply throws, which photoSync treats as "unknown": the phone copy stays
// and the next Profile open tries again. That includes every 404 (a wrong
// address, a route not deployed yet), every other status and network error
// (authedFetch rejects those before this callback), an HTML page, another
// content type and any other JSON body.
export function getProfilePhoto(): Promise<Uint8Array | null> {
  return authedFetch(
    'GET /api/profile-photo',
    photoUrl(),
    { method: 'GET' },
    async (response) => {
      if (response.status !== 200) throw new Error('GET /api/profile-photo: unexpected status');
      const type = mediaType(response.headers.get('content-type'));
      if (type === 'image/jpeg') return new Uint8Array(await response.arrayBuffer());
      if (type === 'application/json' && isNoPhotoBody(await response.text())) return null;
      throw new Error('GET /api/profile-photo: unexpected reply');
    },
    PHOTO_TIMEOUT_MS
  );
}

export function deleteProfilePhoto(): Promise<void> {
  return authedFetch(
    'DELETE /api/profile-photo',
    photoUrl(),
    { method: 'DELETE' },
    async () => undefined,
    PHOTO_TIMEOUT_MS
  );
}
