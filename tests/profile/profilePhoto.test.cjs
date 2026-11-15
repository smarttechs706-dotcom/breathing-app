// Tests for the Profile picture (src/features/profile/profilePhoto.ts) with a
// fake file system, plus source checks for where it is used and app.json.
// Run with:
//   node --test tests/profile/profilePhoto.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const repo = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(repo, f), 'utf8');
const pp = loadTs('src/features/profile/profilePhoto.ts');

const A = '1b4e28ba-2fa1-11d2-883f-0016d3cca427';
const B = '6fa459ea-ee8a-3ca4-894e-db77e160355e';

// An in-memory folder.
function fakeFs(names = []) {
  const files = new Map(names.map((n) => [n, `file:///docs/profile-photo/${n}`]));
  return {
    files,
    list: () => [...files].map(([name, uri]) => ({ name, uri })),
    remove: (name) => files.delete(name),
    copyIn: async (src, name) => {
      const uri = `file:///docs/profile-photo/${name}`;
      files.set(name, uri);
      return uri;
    },
  };
}

test('one file per account: "<account id>-<time>.jpg", unusable ids give nothing', () => {
  assert.equal(pp.photoFileName(A, 1700000000000), `${A}-1700000000000.jpg`);
  assert.equal(pp.photoKey(A.toUpperCase()), A);
  for (const bad of [null, undefined, '', '../../etc', 'short', 'x'.repeat(65)]) {
    assert.equal(pp.photoKey(bad), '', String(bad));
  }
  // Path separators and dots never reach a file name.
  assert.equal(pp.photoKey('../1b4e28ba-2fa1/..'), '1b4e28ba-2fa1');
});

test('save keeps one current photo per account and leaves other accounts alone', async () => {
  const f = fakeFs([`${B}-100.jpg`]);
  const first = await pp.savePhoto(f, A, 'file:///cache/pick1.jpg', 200);
  assert.equal(first, `file:///docs/profile-photo/${A}-200.jpg`);
  const second = await pp.savePhoto(f, A, 'file:///cache/pick2.jpg', 300);
  assert.equal(second, `file:///docs/profile-photo/${A}-300.jpg`);
  assert.deepEqual([...f.files.keys()].sort(), [`${A}-300.jpg`, `${B}-100.jpg`]);
  assert.equal(pp.currentPhoto(f, A), second);
  assert.equal(pp.currentPhoto(f, B), `file:///docs/profile-photo/${B}-100.jpg`);
});

test('the newest file wins if more than one is left; unrelated files are ignored', () => {
  const f = fakeFs([`${A}-100.jpg`, `${A}-900.jpg`, `${A}-x.jpg`, `${A}-500.png`, 'notes.txt']);
  assert.equal(pp.currentPhoto(f, A), `file:///docs/profile-photo/${A}-900.jpg`);
  assert.equal(pp.currentPhoto(fakeFs(), A), null);
  assert.equal(pp.currentPhoto(f, null), null);
});

test('remove deletes only this account\'s photos', () => {
  const f = fakeFs([`${A}-1.jpg`, `${A}-2.jpg`, `${B}-3.jpg`, 'notes.txt']);
  assert.equal(pp.removePhotos(f, A), 2);
  assert.deepEqual([...f.files.keys()].sort(), [`${B}-3.jpg`, 'notes.txt']);
  assert.equal(pp.removePhotos(f, A), 0);
  assert.equal(pp.removePhotos(f, null), 0);
  assert.equal(f.files.size, 2);
});

test('an unusable account id never writes a file', async () => {
  const f = fakeFs();
  assert.equal(await pp.savePhoto(f, 'bad', 'file:///cache/pick.jpg', 1), null);
  assert.equal(f.files.size, 0);
});

test('picker: images only, one photo, square crop; copy is 512 px JPEG at 70%', () => {
  assert.deepEqual(pp.PICKER_OPTIONS, {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    allowsMultipleSelection: false,
    quality: 1,
  });
  assert.equal(pp.PHOTO_SIZE, 512);
  assert.equal(pp.PHOTO_QUALITY, 0.7);
  const store = read('src/features/profile/profilePhotoStore.ts');
  assert.ok(store.includes('launchImageLibraryAsync(PICKER_OPTIONS)'));
  assert.ok(store.includes('.resize({ width: PHOTO_SIZE })'));
  assert.ok(store.includes('saveAsync({ compress: PHOTO_QUALITY, format: SaveFormat.JPEG })'));
  assert.ok(store.includes('new Directory(Paths.document, PHOTO_FOLDER)'));
  assert.ok(!/launchCameraAsync|fetch\(|upload/i.test(store.replace(/\/\/.*$/gm, '')), 'no camera, no upload');
});

test('Profile only: a tappable picture opening the in-app sheet, with spoken labels', () => {
  const src = read('src/features/profile/ProfileScreen.tsx');
  // The circle opens the sheet; the sheet's choices keep the old behaviour.
  assert.ok(src.includes('const openPhotoChoices = useCallback(() => setSheetOpen(true), []);'));
  assert.ok(src.includes('hasPhoto={photoUri !== null}'), 'Remove photo only when there is one');
  assert.ok(/if \(action === 'choose'\) \{\s*void choosePhoto\(\);\s*\} else \{\s*removeProfilePhoto\(userId\);\s*setPhotoUri\(null\);/.test(src));
  // The system Alert is used only for the failure message now.
  assert.equal((src.match(/Alert\.alert\(/g) || []).length, 1);
  assert.ok(src.includes(`Alert.alert("Couldn't use that photo", 'Please try a different one.');`));
  assert.ok(src.includes('accessibilityLabel={`Profile picture, ${firstName ?? \'Your profile\'}`}'));
  assert.ok(src.includes('accessibilityHint="Choose or remove a photo"'));
  assert.ok(src.includes('onError={() => setPhotoUri(null)}'), 'falls back to the initial if the file fails');
  // No other screen shows the photo (the header avatars are gone since 2026-11-15).
  for (const f of ['src/components/AccountAvatar.tsx', 'app/settings.tsx']) {
    assert.ok(!read(f).includes('getProfilePhotoUri'), f);
  }
});

test('cleared on a user-initiated sign out and on Delete my data, never on the automatic sign-out', () => {
  const settings = read('app/settings.tsx');
  assert.ok(/if \(await confirmSignOut\(\)\) \{[\s\S]*?removeProfilePhoto\(session\?\.user\.id\);[\s\S]*?await signOut\(\);/.test(settings));
  assert.ok(settings.includes('await deleteMyData(session?.user.id)'));
  assert.ok(read('src/utils/deleteMyData.ts').includes('() => removeProfilePhoto(userId),'));
  // The automatic sign-out (session expiry) and the launch sweep do not touch it.
  for (const f of ['src/auth/AuthProvider.tsx', 'src/auth/sessionExpiry.ts', 'src/utils/legacyCleanup.ts']) {
    assert.ok(!/profilePhoto|removeProfilePhoto/.test(read(f)), f);
  }
});

test('app.json: picker without camera or microphone; camera, media, biometric permissions blocked', () => {
  const { expo } = JSON.parse(read('app.json'));
  const picker = expo.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker');
  assert.deepEqual(picker[1], { cameraPermission: false, microphonePermission: false });
  for (const p of [
    'CAMERA',
    'RECORD_AUDIO',
    'READ_MEDIA_IMAGES',
    'READ_MEDIA_VIDEO',
    'READ_MEDIA_VISUAL_USER_SELECTED',
    'READ_EXTERNAL_STORAGE',
    'WRITE_EXTERNAL_STORAGE',
    'SYSTEM_ALERT_WINDOW',
    'USE_BIOMETRIC',
    'USE_FINGERPRINT',
  ]) {
    assert.ok(expo.android.blockedPermissions.includes(`android.permission.${p}`), p);
  }
  assert.equal(expo.android.allowBackup, false, 'the photo is not backed up');
});

test('no long dashes or emoji in the new code', () => {
  for (const f of ['src/features/profile/profilePhoto.ts', 'src/features/profile/profilePhotoStore.ts']) {
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(read(f)), f);
  }
});

// --- Edit badge on the Profile circle (2026-11-15) ---------------------------

test('edit badge: Profile only, a 22 dp indigo circle with a 12 dp white pencil, no shadow or animation', () => {
  const src = read('src/features/profile/ProfileScreen.tsx');
  assert.ok(src.includes('const EDIT_BADGE = 22;'));
  assert.ok(src.includes('const EDIT_ICON = 12;'));
  assert.ok(src.includes('<Ionicons name="pencil" size={EDIT_ICON} color="#ffffff" />'));
  const badge = src.slice(src.indexOf('  editBadge: {'), src.indexOf('},', src.indexOf('  editBadge: {')));
  assert.ok(badge.includes('backgroundColor: colors.inversePrimary,'));
  assert.ok(badge.includes('borderColor: BACKDROP_TOP,'));
  assert.ok(badge.includes("position: 'absolute',"), 'overlaps without moving the layout');
  assert.ok(!/shadow|elevation/i.test(badge), 'no shadow');
  // Only ProfileScreen has the badge.
  for (const f of ['src/features/home/PreviewHeader.tsx', 'src/features/library/LibraryScreen.tsx', 'src/features/insights/InsightsScreen.tsx', 'app/settings.tsx', 'src/components/AccountAvatar.tsx']) {
    assert.ok(!/editBadge|name="pencil"/.test(read(f)), f);
  }
  // The pencil icon exists in the bundled Ionicons font.
  const glyphs = require(path.join(repo, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'));
  assert.ok('pencil' in glyphs);
});

test('edit badge is decorative: inside the one button, not a tap target, not read aloud; label unchanged', () => {
  const src = read('src/features/profile/ProfileScreen.tsx');
  const button = src.slice(src.indexOf('onPress={openPhotoChoices}'), src.indexOf('</Pressable>', src.indexOf('onPress={openPhotoChoices}')));
  assert.ok(button.includes('<View\n                style={styles.editBadge}') || button.includes('style={styles.editBadge}'), 'badge inside the button');
  assert.ok(/style=\{styles\.editBadge\}\s+pointerEvents="none"\s+accessible=\{false\}\s+importantForAccessibility="no-hide-descendants"/.test(button));
  assert.equal((src.match(/onPress=\{openPhotoChoices\}/g) || []).length, 1, 'one button only');
  assert.ok(src.includes('accessibilityLabel={`Profile picture, ${firstName ?? \'Your profile\'}`}'));
  assert.ok(src.includes('accessibilityHint="Choose or remove a photo"'));
});

test('the avatar box keeps its 72 dp size and bottom margin, so the name does not move; photo and initial both stay clipped round', () => {
  const src = read('src/features/profile/ProfileScreen.tsx');
  assert.ok(/avatarButton: \{\s*width: AVATAR,\s*height: AVATAR,\s*marginBottom: spacing\.base,\s*\}/.test(src));
  assert.ok(/  avatar: \{[\s\S]*?overflow: 'hidden',/.test(src));
  assert.ok(!/  avatar: \{[\s^}]*?marginBottom/.test(src.slice(src.indexOf('  avatar: {'), src.indexOf('},', src.indexOf('  avatar: {')))));
  assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(src), 'no long dashes or emoji');
});

// --- The "Profile picture" sheet (PhotoSheet.tsx, 2026-11-15) ---------------

test('sheet rows: Choose from gallery, Remove photo only with a photo, then Cancel; outline icons; Remove in the error colour', () => {
  assert.deepEqual(pp.photoSheetRows(false).map((r) => [r.action, r.label, r.icon]), [
    ['choose', 'Choose from gallery', 'images-outline'],
    ['cancel', 'Cancel', 'close-outline'],
  ]);
  assert.deepEqual(pp.photoSheetRows(true).map((r) => [r.action, r.label, r.icon, r.danger]), [
    ['choose', 'Choose from gallery', 'images-outline', false],
    ['remove', 'Remove photo', 'trash-outline', true],
    ['cancel', 'Cancel', 'close-outline', false],
  ]);
  const glyphs = require(path.join(repo, 'node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json'));
  for (const r of pp.photoSheetRows(true)) assert.ok(r.icon in glyphs, r.icon);
  const sheet = read('src/features/profile/PhotoSheet.tsx');
  assert.ok(sheet.includes('color={row.danger ? colors.error : colors.onSurfaceVariant}'));
  assert.ok(sheet.includes('style={[styles.rowLabel, row.danger && styles.danger]}'));
});

test('sheet closes on the backdrop, the Cancel row and Android back; actions run after it has closed', () => {
  const sheet = read('src/features/profile/PhotoSheet.tsx');
  assert.ok(sheet.includes('onRequestClose={() => close()}'), 'Android back');
  assert.ok(/style=\{styles\.backdrop\}\s+onPress=\{\(\) => close\(\)\}/.test(sheet), 'backdrop');
  assert.ok(sheet.includes("if (action === 'cancel') close();"), 'Cancel');
  assert.ok(sheet.includes('else close(() => onAction(action));'), 'choose and remove run after closing');
});

test('sheet matches the app modals and respects reduced motion; accessible as a dialog', () => {
  const sheet = read('src/features/profile/PhotoSheet.tsx');
  for (const must of ['transparent', 'statusBarTranslucent', 'navigationBarTranslucent', "backgroundColor: 'rgba(0,0,0,0.75)'", 'borderTopLeftRadius: radii.lg', 'borderColor: accents.glassBorder', 'easing: EASE_OUT']) {
    assert.ok(sheet.includes(must), must);
  }
  // Reduced motion: appears without sliding.
  assert.ok(sheet.includes('const instant = reduced !== false;'));
  assert.ok(/if \(instant\) \{\s*slide\.setValue\(0\);\s*fade\.setValue\(1\);/.test(sheet));
  // Dialog role, header title, rows are buttons with labels.
  assert.ok(sheet.includes('role="dialog"'));
  assert.ok(sheet.includes('accessibilityViewIsModal'));
  assert.ok(/<Text style=\{styles\.title\} accessibilityRole="header">\s*Profile picture/.test(sheet));
  assert.ok(sheet.includes('accessibilityRole="button"\n            accessibilityLabel={row.label}'));
  // Existing text roles only.
  assert.ok(sheet.includes('...text.sectionTitle,'));
  assert.ok(sheet.includes('...typography.bodyMd,'));
  assert.ok(!/fontFamily:|fontWeight:/.test(sheet));
});

test('no long dashes or emoji in the sheet, the badge or the Profile screen', () => {
  for (const f of ['src/features/profile/PhotoSheet.tsx', 'src/features/profile/ProfileScreen.tsx', 'src/features/profile/profilePhoto.ts']) {
    assert.ok(!/[–—]|\p{Extended_Pictographic}/u.test(read(f)), f);
  }
});
