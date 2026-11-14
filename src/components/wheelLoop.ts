// Pure index maths for the looping hour and minute wheels in
// TimePickerModal.tsx. No React Native imports, so it is tested directly in
// Node (tests/reminder/timePicker.test.cjs).
//
// A looping wheel repeats its list (an odd number of copies, about LOOP_ROWS
// rows in all) and opens on the middle copy, so there are numbers in both
// directions and never an empty end. When a scroll comes to rest it jumps,
// without animation, to the same value in the middle copy; the rows look
// identical, so the jump is invisible and scrolling can go on for ever.
// The value is always the row index wrapped to the list length.

export const LOOP_ROWS = 180;

// Copies of a list of `length` items: at least LOOP_ROWS rows, and odd so
// there is a middle copy (hours: 15 x 12, minutes: 3 x 60).
export function loopCopies(length: number): number {
  const copies = Math.ceil(LOOP_ROWS / length);
  return copies % 2 === 0 ? copies + 1 : copies;
}

// Row index -> index into the original list (works for negative rows too).
export function wrapIndex(row: number, length: number): number {
  return ((row % length) + length) % length;
}

// The row for list item `index` in the middle copy.
export function middleRow(index: number, length: number, copies: number): number {
  return Math.floor(copies / 2) * length + index;
}

// The same value as `row`, moved to the middle copy.
export function recenterRow(row: number, length: number, copies: number): number {
  return middleRow(wrapIndex(row, length), length, copies);
}
