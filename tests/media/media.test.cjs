// Tests for the bundled background media and the native media config.
// Run with:
//   node --test tests/media/media.test.cjs
// Reads the MP4/M4A headers directly (no ffprobe needed).

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const repo = path.join(__dirname, '..', '..');

// The files exactly as delivered: never modified or re-encoded.
const MEDIA = {
  'assets/videos/breathing-background-loop.mp4':
    'd8eaa1c82989122de900d9c57795ae9b7f997a90fb0da341ea9e78fe97b71b37',
  'assets/videos/home-horizon-band-loop.mp4':
    'd9a532f9206b416c15eff8ca709b991ab21cba1c5b55aaf4b7ac6e6bf953e011',
  'assets/audio/home-ambient-loop.m4a':
    '13acf1fae19442a8d255e4d11dc9bbb69f31ee75bc1b6d11ec410d58221b2e17',
};

// Minimal ISO-BMFF reader: overall duration, and per track its handler type
// (vide/soun), width and height.
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'edts']);
function readMp4(file) {
  const b = fs.readFileSync(path.join(repo, file));
  const info = { duration: null, tracks: [] };
  let track = null;
  (function walk(start, end) {
    let p = start;
    while (p + 8 <= end) {
      let size = b.readUInt32BE(p);
      const type = b.toString('latin1', p + 4, p + 8);
      let header = 8;
      if (size === 1) {
        size = Number(b.readBigUInt64BE(p + 8));
        header = 16;
      } else if (size === 0) {
        size = end - p;
      }
      const v = b[p + header];
      if (type === 'mvhd') {
        const scale = v ? b.readUInt32BE(p + header + 20) : b.readUInt32BE(p + header + 12);
        const dur = v ? Number(b.readBigUInt64BE(p + header + 24)) : b.readUInt32BE(p + header + 16);
        info.duration = dur / scale;
      }
      if (type === 'trak') {
        track = {};
        info.tracks.push(track);
      }
      if (type === 'tkhd') {
        const o = p + header + (v ? 88 : 76);
        track.width = b.readUInt32BE(o) / 65536;
        track.height = b.readUInt32BE(o + 4) / 65536;
      }
      if (type === 'hdlr') track.type = b.toString('latin1', p + header + 8, p + header + 12);
      if (CONTAINERS.has(type)) walk(p + header, p + size);
      p += size;
    }
  })(0, b.length);
  return info;
}

test('the three media files are byte-for-byte the delivered files', () => {
  for (const [file, sha] of Object.entries(MEDIA)) {
    const data = fs.readFileSync(path.join(repo, file));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), sha, file);
  }
});

test('breathing background: 720x1280 portrait, 9 s, video only (no audio track)', () => {
  const info = readMp4('assets/videos/breathing-background-loop.mp4');
  assert.deepEqual(info.tracks.map((t) => t.type), ['vide']);
  assert.equal(info.tracks[0].width, 720);
  assert.equal(info.tracks[0].height, 1280);
  assert.ok(Math.abs(info.duration - 9) < 0.05, `duration ${info.duration}`);
});

test('horizon band: 1280x512 (2.5 : 1), about 7.08 s, video only (no audio track)', () => {
  const info = readMp4('assets/videos/home-horizon-band-loop.mp4');
  assert.deepEqual(info.tracks.map((t) => t.type), ['vide']);
  assert.equal(info.tracks[0].width, 1280);
  assert.equal(info.tracks[0].height, 512);
  assert.equal(info.tracks[0].width / info.tracks[0].height, 2.5);
  assert.ok(Math.abs(info.duration - 7.08) < 0.05, `duration ${info.duration}`);
});

test('ambient sound: one audio track, about 7.2 s', () => {
  const info = readMp4('assets/audio/home-ambient-loop.m4a');
  assert.deepEqual(info.tracks.map((t) => t.type), ['soun']);
  assert.ok(Math.abs(info.duration - 7.24) < 0.05, `duration ${info.duration}`);
});

test('LoopingVideo: muted loop, no controls, never takes audio focus, lets the screen sleep', () => {
  const src = fs.readFileSync(path.join(repo, 'src/features/media/LoopingVideo.tsx'), 'utf8');
  assert.ok(src.includes('p.loop = true;'));
  assert.ok(src.includes('p.muted = true;'));
  assert.ok(src.includes("p.audioMixingMode = 'mixWithOthers';"));
  assert.ok(src.includes('p.keepScreenOnWhilePlaying = false;'));
  assert.ok(src.includes('nativeControls={false}'));
  assert.ok(src.includes('allowsPictureInPicture={false}'));
  assert.ok(!/staysActiveInBackground\s*=\s*true/.test(src));
});

test('LoopingVideo: mounted only while focused, foreground and motion allowed; removed on error', () => {
  const src = fs.readFileSync(path.join(repo, 'src/features/media/LoopingVideo.tsx'), 'utf8');
  assert.ok(src.includes('const { running } = useAmbientMotion();'));
  assert.ok(src.includes('if (!running) return null;'));
  assert.ok(/status === 'error'\) setFailed\(true\)/.test(src));
  assert.ok(src.includes('if (failed) return null;'));
  // useAmbientMotion gates on focus, AppState and reduced motion.
  const motion = fs.readFileSync(path.join(repo, 'src/features/home/motion.tsx'), 'utf8');
  assert.ok(motion.includes('running: allowed && focused && foreground'));
});

test('Home: the band plays the horizon video in a TextureView (it sits in a ScrollView)', () => {
  const band = fs.readFileSync(path.join(repo, 'src/features/home/HorizonBand.tsx'), 'utf8');
  assert.ok(band.includes("require('../../../assets/videos/home-horizon-band-loop.mp4')"));
  assert.ok(band.includes('<LoopingVideo source={SOURCE} surfaceType="textureView" />'));
  // Light edges: each fade covers 12% of the band; no tint or dim layer.
  assert.ok(band.includes('export const BAND_EDGE_FADE = 0.12;'));
  assert.ok(!/rgba\(|backgroundColor|opacity:/.test(band), 'no tint over the video');
  const home = fs.readFileSync(path.join(repo, 'src/features/home/HomeScreen.tsx'), 'utf8');
  assert.ok(home.includes('<HorizonBand height={Math.round(windowW / BAND_ASPECT)}'));
  // No sound or video controls anywhere on Home.
  assert.ok(!/volume-(high|mute|off)|Switch|nativeControls=\{true\}/.test(home + band));
});

test('app.json: video and audio plugins with background playback and recording off', () => {
  const { expo } = JSON.parse(fs.readFileSync(path.join(repo, 'app.json'), 'utf8'));
  const plugin = (name) => expo.plugins.find((p) => Array.isArray(p) && p[0] === name);
  assert.deepEqual(plugin('expo-video')[1], {
    supportsBackgroundPlayback: false,
    supportsPictureInPicture: false,
  });
  // expo-audio defaults both of these to true.
  assert.equal(plugin('expo-audio')[1].enableBackgroundPlayback, false);
  assert.equal(plugin('expo-audio')[1].recordAudioAndroid, false);
  assert.ok(expo.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
});
