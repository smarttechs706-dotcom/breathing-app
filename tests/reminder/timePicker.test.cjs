// Source checks for the restyled reminder time picker (visual only). Run with:
//   node --test tests/reminder/timePicker.test.cjs

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src/components/TimePickerModal.tsx'), 'utf8');

test('full-screen mist backdrop; no card, panel or dim overlay', () => {
  assert.ok(src.includes('<ScreenBackdrop painting={MIST_BACKGROUND} />'));
  assert.ok(!/GlassCard|PreviewGlass|surfaceContainerHigh/.test(src), 'no card or panel');
  assert.ok(!/rgba\(0,\s*0,\s*0/.test(src), 'no dim overlay');
});

test('no selected-row highlight shape; the selected row is white and fades by opacity only', () => {
  assert.ok(!/highlightBand|primaryContainer/.test(src));
  assert.ok(/wheelItemText: \{[\s\S]*?fontSize: 15,[\s\S]*?color: '#ffffff'/.test(src));
  assert.ok(src.includes('const OPACITY_STEPS = [1, 0.5, 0.3, 0.15];'));
});

test('Confirm uses the shared indigo gradient pill, Cancel is plain white text below it', () => {
  assert.ok(src.includes('colors={[colors.inversePrimary, colors.onPrimaryFixedVariant]}'));
  const confirm = src.indexOf('onPress={handleConfirm}');
  const cancel = src.indexOf('<Pressable onPress={onCancel} hitSlop={8}');
  assert.ok(confirm > -1 && cancel > confirm, 'Cancel comes after Confirm');
  assert.ok(/cancelButtonText: \{[\s\S]*?color: '#ffffff'/.test(src));
});

test('no light blue, no direct font settings', () => {
  assert.ok(!/colors\.primary\b|#b9c3ff/i.test(src));
  assert.ok(!/fontFamily:|fontWeight:/.test(src));
});

test('handlers unchanged: Android back and outside tap cancel, Confirm reads the wheels', () => {
  assert.ok(src.includes('onRequestClose={onCancel}'));
  assert.ok(src.includes('<Pressable style={styles.backdrop} onPress={onCancel}>'));
  assert.ok(src.includes('onConfirm(to24Hour(hour12, period), minute);'));
});

// --- Looping hour and minute wheels (src/components/wheelLoop.ts) ---------

const { loadTs } = require('../auth/helpers.cjs');
const loop = loadTs('src/components/wheelLoop.ts');
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

test('loop copies: about 180 rows, odd so there is a middle copy (hours 15 x 12, minutes 3 x 60)', () => {
  assert.equal(loop.loopCopies(12), 15);
  assert.equal(loop.loopCopies(60), 3);
  for (const n of [12, 60]) assert.equal(loop.loopCopies(n) % 2, 1);
});

test('after 12 comes 1 and before 1 comes 12; after 59 comes 00 and before 00 comes 59', () => {
  const hourAt = (row) => HOURS[loop.wrapIndex(row, 12)];
  const minuteAt = (row) => MINUTES[loop.wrapIndex(row, 60)];
  const h12 = loop.middleRow(11, 12, 15); // the 12 in the middle copy
  assert.equal(hourAt(h12), 12);
  assert.equal(hourAt(h12 + 1), 1);
  const h1 = loop.middleRow(0, 12, 15);
  assert.equal(hourAt(h1 - 1), 12);
  const m59 = loop.middleRow(59, 60, 3);
  assert.equal(minuteAt(m59), 59);
  assert.equal(minuteAt(m59 + 1), 0);
  assert.equal(minuteAt(loop.middleRow(0, 60, 3) - 1), 59);
});

test('the value read back always equals the value shown, and re-centring keeps it', () => {
  for (const [list, copies] of [[HOURS, 15], [MINUTES, 3]]) {
    const n = list.length;
    for (let row = 0; row < n * copies; row++) {
      const shown = list[loop.wrapIndex(row, n)];
      const centred = loop.recenterRow(row, n, copies);
      assert.equal(list[loop.wrapIndex(centred, n)], shown, `row ${row}`);
      // The middle copy leaves at least about 90 rows of numbers each way.
      assert.ok(centred >= Math.floor(copies / 2) * n && centred < (Math.floor(copies / 2) + 1) * n);
    }
  }
  assert.equal(loop.wrapIndex(-1, 12), 11);
});

test('hour and minute wheels loop; AM/PM does not; fade and scale run on the native driver', () => {
  const hourBlock = src.slice(src.indexOf('key={`hour-${openToken}`}'), src.indexOf('key={`minute-${openToken}`}'));
  const minuteBlock = src.slice(src.indexOf('key={`minute-${openToken}`}'), src.indexOf('key={`period-${openToken}`}'));
  const periodBlock = src.slice(src.indexOf('key={`period-${openToken}`}'), src.indexOf('</View>', src.indexOf('key={`period-${openToken}`}')));
  assert.ok(/\bloop\b/.test(hourBlock), 'hour wheel loops');
  assert.ok(/\bloop\b/.test(minuteBlock), 'minute wheel loops');
  assert.ok(!/\bloop\b/.test(periodBlock), 'AM/PM does not loop');
  assert.ok(src.includes('useNativeDriver: true,'));
});

test('the saved value path is byte-for-byte unchanged (to12Hour, to24Hour, handleConfirm)', () => {
  const { execSync } = require('node:child_process');
  const before = execSync('git show 993b5cc:src/components/TimePickerModal.tsx', {
    cwd: path.join(__dirname, '..', '..'),
  }).toString().replace(/\r\n/g, '\n');
  const now = src.replace(/\r\n/g, '\n');
  const block = (text, start, end) => text.slice(text.indexOf(start), text.indexOf(end, text.indexOf(start)) + end.length);
  for (const [start, end] of [
    ['function to12Hour', '\n}\n'],
    ['function to24Hour', '\n}\n'],
    ['function handleConfirm()', '\n  }\n'],
  ]) {
    assert.equal(block(now, start, end), block(before, start, end), start);
  }
});
