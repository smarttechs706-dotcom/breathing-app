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
