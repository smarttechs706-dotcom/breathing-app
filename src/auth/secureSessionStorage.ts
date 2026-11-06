import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keeps the Supabase session in SecureStore. Session JSON can be larger than
// the ~2048 bytes SecureStore is safe with (Expo docs: large values can be
// rejected), so a value is split into chunks.
//
// Layout for key K, generation G, n chunks:
//   K.G.0 ... K.G.(n-1)   the chunks
//   K.m                   manifest: {"g":G,"n":n}
//
// New chunks go under a new generation and the manifest is written LAST, so
// an interrupted write leaves the previous value readable. Anything unreadable
// reads as null: the user logs in again, the app does not crash.

const MAX_CHUNK_BYTES = 1800;

interface Manifest {
  g: number;
  n: number;
}

function utf8Length(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
}

// Splits on code points, so a multi-byte character is never cut in half.
export function splitUtf8(value: string, maxBytes: number = MAX_CHUNK_BYTES): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of value) {
    const bytes = utf8Length(char.codePointAt(0) as number);
    if (currentBytes + bytes > maxBytes) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  if (current.length > 0 || chunks.length === 0) chunks.push(current);
  return chunks;
}

const manifestKey = (key: string) => `${key}.m`;
const chunkKey = (key: string, generation: number, index: number) =>
  `${key}.${generation}.${index}`;

async function readManifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(manifestKey(key));
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { g, n } = parsed as Partial<Manifest>;
  if (!Number.isInteger(g) || !Number.isInteger(n) || (n as number) < 1) return null;
  return { g: g as number, n: n as number };
}

async function deleteChunks(key: string, manifest: Manifest): Promise<void> {
  for (let i = 0; i < manifest.n; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, manifest.g, i));
  }
}

// One operation at a time: two overlapping writes could otherwise pick the
// same generation and mix their chunks.
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const run = queue.then(operation, operation);
  queue = run.catch(() => undefined);
  return run;
}

async function getChunked(key: string): Promise<string | null> {
  try {
    const manifest = await readManifest(key);
    if (!manifest) return null;
    let value = '';
    for (let i = 0; i < manifest.n; i++) {
      const chunk = await SecureStore.getItemAsync(chunkKey(key, manifest.g, i));
      if (chunk === null) return null;
      value += chunk;
    }
    return value;
  } catch {
    return null;
  }
}

async function setChunked(key: string, value: string): Promise<void> {
  let previous: Manifest | null = null;
  try {
    previous = await readManifest(key);
  } catch {
    previous = null;
  }

  const generation = (previous?.g ?? 0) + 1;
  const chunks = splitUtf8(value);
  for (let i = 0; i < chunks.length; i++) {
    await SecureStore.setItemAsync(chunkKey(key, generation, i), chunks[i]);
  }
  await SecureStore.setItemAsync(
    manifestKey(key),
    JSON.stringify({ g: generation, n: chunks.length })
  );

  if (previous) {
    // Already committed; a leftover old chunk is only wasted space.
    await deleteChunks(key, previous).catch(() => undefined);
  }
}

async function removeChunked(key: string): Promise<void> {
  let manifest: Manifest | null = null;
  try {
    manifest = await readManifest(key);
  } catch {
    manifest = null;
  }
  // Manifest first: from here the value reads as gone.
  await SecureStore.deleteItemAsync(manifestKey(key));
  if (manifest) await deleteChunks(key, manifest).catch(() => undefined);
}

export const secureSessionStorage = {
  getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return enqueue(() => getChunked(key));
  },
  setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    return enqueue(() => setChunked(key, value));
  },
  removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    return enqueue(() => removeChunked(key));
  },
};

// SPIKE ONLY: sizes, never contents.
export async function inspectStoredValue(
  key: string
): Promise<{ bytes: number; chunks: number } | null> {
  const value = await secureSessionStorage.getItem(key);
  if (value === null) return null;
  const chunks = splitUtf8(value);
  let bytes = 0;
  for (const char of value) bytes += utf8Length(char.codePointAt(0) as number);
  return { bytes, chunks: chunks.length };
}
