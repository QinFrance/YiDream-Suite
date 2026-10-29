export const MANIFEST_URL = 'https://qinfrance.github.io/YiDream/version.json';
export const APK_URL = 'https://qinfrance.github.io/YiDream/admin/yidream.apk';

/** The admin and the device updater consume the same release, with no stale fallback. */
export async function fetchCurrentApk(fetcher = fetch, cryptoProvider = crypto) {
  const manifestResponse = await fetcher(MANIFEST_URL, { cache: 'no-store', redirect: 'error' });
  if (!manifestResponse.ok) throw new Error('Manifeste YiDream indisponible.');
  const manifest = await manifestResponse.json();
  if (manifest.apkUrl !== APK_URL || !/^[a-f0-9]{64}$/i.test(manifest.apkSha256 || '') ||
      !Number.isInteger(manifest.versionCode) || manifest.versionCode < 12) {
    throw new Error('Version YiDream ou empreinte invalide.');
  }
  const response = await fetcher(APK_URL, { cache: 'no-store', redirect: 'error' });
  if (!response.ok) throw new Error('APK YiDream indisponible.');
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > 250 * 1024 * 1024) throw new Error('Taille APK invalide.');
  const digest = new Uint8Array(await cryptoProvider.subtle.digest('SHA-256', bytes));
  const actual = Array.from(digest, x => x.toString(16).padStart(2, '0')).join('');
  if (actual !== manifest.apkSha256.toLowerCase()) throw new Error('L’APK ne correspond pas à la version publiée. Actualisez puis réessayez.');
  return { blob: new Blob([bytes], { type: 'application/vnd.android.package-archive' }), versionName: String(manifest.versionName || ''), versionCode: manifest.versionCode };
}
