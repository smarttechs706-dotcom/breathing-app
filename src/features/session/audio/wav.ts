// WAV (RIFF, PCM) for the voice guidance track: 16-bit mono at 22.05 kHz, the
// same format the voice clips must have. Writing the 44-byte header and
// reading clips back to samples. Little-endian is written explicitly, so the
// bytes do not depend on the device. No React Native imports (tested in Node,
// tests/session/voiceMixer.test.cjs).

export const SAMPLE_RATE = 22050;
export const BITS_PER_SAMPLE = 16;
export const CHANNELS = 1;
export const HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

// Sample index of a time in ms (rounded). Integer-second phases are exact.
export function msToSamples(ms: number, rate: number = SAMPLE_RATE): number {
  return Math.round((ms * rate) / 1000);
}

export function dataBytesFor(samples: number): number {
  return samples * CHANNELS * BYTES_PER_SAMPLE;
}

// The header for `dataBytes` bytes of 16-bit mono PCM at `rate`.
export function wavHeader(dataBytes: number, rate: number = SAMPLE_RATE): Uint8Array {
  const bytes = new Uint8Array(HEADER_BYTES);
  const v = new DataView(bytes.buffer);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, CHANNELS, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * CHANNELS * BYTES_PER_SAMPLE, true); // byte rate
  v.setUint16(32, CHANNELS * BYTES_PER_SAMPLE, true); // block align
  v.setUint16(34, BITS_PER_SAMPLE, true);
  ascii(36, 'data');
  v.setUint32(40, dataBytes, true);
  return bytes;
}

// Samples as little-endian bytes.
export function samplesToBytes(samples: Int16Array): Uint8Array {
  const out = new Uint8Array(samples.length * BYTES_PER_SAMPLE);
  const v = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) v.setInt16(i * 2, samples[i], true);
  return out;
}

export interface WavClip {
  rate: number;
  samples: Int16Array;
}

// Reads a 16-bit mono PCM WAV (other chunks, such as LIST, are skipped).
// null for anything else: not RIFF/WAVE, not PCM, stereo, not 16-bit, or cut
// short. The clip check (step 7) uses this to reject a wrong file.
export function parseWav(bytes: Uint8Array): WavClip | null {
  if (bytes.length < 12) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let rate = 0;
  let ok = false;
  let at = 12;
  while (at + 8 <= bytes.length) {
    const id = tag(at);
    const size = v.getUint32(at + 4, true);
    const body = at + 8;
    if (id === 'fmt ') {
      if (size < 16 || body + 16 > bytes.length) return null;
      const format = v.getUint16(body, true);
      const channels = v.getUint16(body + 2, true);
      rate = v.getUint32(body + 4, true);
      const bits = v.getUint16(body + 14, true);
      ok = format === 1 && channels === CHANNELS && bits === BITS_PER_SAMPLE && rate > 0;
      if (!ok) return null;
    } else if (id === 'data') {
      if (!ok || body + size > bytes.length || size % 2 !== 0) return null;
      const samples = new Int16Array(size / 2);
      for (let i = 0; i < samples.length; i++) samples[i] = v.getInt16(body + i * 2, true);
      return { rate, samples };
    }
    at = body + size + (size % 2); // chunks are padded to an even size
  }
  return null;
}
