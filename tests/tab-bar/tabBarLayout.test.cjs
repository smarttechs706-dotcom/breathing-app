// Tests for the floating tab bar's layout maths (src/features/tab-bar). Run with:
//   node --test tests/tab-bar/tabBarLayout.test.cjs
// Reuses the auth tests' TypeScript loader; it is not part of `npm run test:auth`.

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { loadTs } = require('../auth/helpers.cjs');

const bar = loadTs('src/features/tab-bar/tabBarLayout.ts');

// The test phone (1080 px at 2.75 px/dp) and a small and a large phone.
const PHONE_W = 1080 / 2.75;
const WIDTHS = [320, 360, PHONE_W, 430];

test('the pill is tabs x 74 + 8 dp wide: 230 dp for 3 tabs, 304 dp for a test 4th', () => {
  assert.equal(bar.pillLayout(PHONE_W, 3).width, 230);
  assert.equal(bar.pillLayout(PHONE_W, 4).width, 304);
  // A fourth tab simply adds one slot.
  assert.equal(bar.pillLayout(PHONE_W, 4).width - bar.pillLayout(PHONE_W, 3).width, 74);
  assert.equal(bar.pillLayout(PHONE_W, 3).tabWidth, 74);
  assert.equal(bar.pillLayout(PHONE_W, 4).tabWidth, 74);
});

test('the pill is 56 dp tall, floats 16 dp up, is centred and never nearer than 12 dp to an edge', () => {
  assert.equal(bar.PILL_FLOAT, 16);
  for (const w of WIDTHS) {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const l = bar.pillLayout(w, n);
      assert.equal(l.height, 56);
      assert.ok(Math.abs(l.left - (w - l.width) / 2) < 1e-9, `centred at ${w}/${n}`);
      assert.ok(l.left >= bar.SCREEN_MARGIN - 1e-9, `margin at ${w}/${n}`);
    }
  }
});

test('on a narrow screen the slots shrink to fit, but every tab stays at least 48 x 48 dp', () => {
  // 320 dp wide, 4 tabs: 304 dp would leave only 8 dp margins, so it narrows.
  const l = bar.pillLayout(320, 4);
  assert.equal(l.width, 320 - 2 * bar.SCREEN_MARGIN);
  assert.ok(l.tabWidth < 74 && l.tabWidth >= 48);
});

test('every tab keeps at least a 48 x 48 dp tap target, with 3 tabs and with a test 4th', () => {
  for (const w of WIDTHS) {
    for (const n of [3, 4]) {
      const l = bar.pillLayout(w, n);
      assert.ok(l.tabWidth >= 48, `${n} tabs at ${w} dp: width ${l.tabWidth}`);
      assert.ok(l.tabHeight >= 48, `${n} tabs at ${w} dp: height ${l.tabHeight}`);
      // The tabs exactly fill the pill's inner row.
      assert.ok(Math.abs(n * l.tabWidth + 2 * bar.PILL_PADDING - l.width) < 1e-9);
    }
  }
});

test('the highlight is 70 x 48 dp, 2 dp in from the slot sides, for every tab index', () => {
  for (const n of [3, 4]) {
    const l = bar.pillLayout(PHONE_W, n);
    for (let i = 0; i < n; i++) {
      const h = bar.highlightFrame(l, i);
      assert.equal(h.width, 70);
      assert.equal(h.height, 48);
      const slotLeft = bar.PILL_PADDING + i * l.tabWidth;
      assert.equal(h.x - slotLeft, 2, `${n} tabs, index ${i}: left inset`);
      assert.equal(slotLeft + l.tabWidth - (h.x + h.width), 2, `${n} tabs, index ${i}: right inset`);
      assert.ok(h.y >= 0 && h.y + h.height <= l.height + 1e-9);
    }
    // Sliding from one tab to the next moves by exactly one slot.
    const step = bar.highlightFrame(l, 1).x - bar.highlightFrame(l, 0).x;
    assert.equal(step, l.tabWidth);
  }
});

test('screens reserve the pill, its float gap and the bottom inset', () => {
  assert.equal(bar.reservedHeight(0), 56 + 16);
  assert.equal(bar.reservedHeight(24), 56 + 16 + 24);
  assert.equal(bar.reservedHeight(-5), 56 + 16);
});
