import { Image, type ImageSourcePropType } from 'react-native';

import type { DayPhase } from './timeOfDay';

// One scene per time of day. A painting is used when `image` is set; the
// drawn scene (sky, hills, water, sun or moon from these colors) is the
// fallback for any phase without one.
//
// Paintings live in ./images as JPG copies of the PNGs in
// assets/design-reference/ (quality 80). They fill the screen from the top.
export interface Scene {
  image?: ImageSourcePropType;
  // The painting's bottom-edge colour (sampled), used to fill below it when
  // it is shifted up to bring the horizon to PAINTED_HORIZON_ON_SCREEN.
  imageBottom?: string;
  // Horizon as a share of the scene's own height. The paintings put it at
  // about half (row ~925 of 1844); the drawn scene at 40% like the reference.
  horizon: number;
  sky: [string, string, string, string]; // top -> horizon
  water: [string, string, string]; // horizon -> bottom
  farHills: string;
  nearHills: string;
  light: { kind: 'sun' | 'moon'; color: string; glow: number };
  // Faint dark disc behind the orb, for skies too bright for its glow alone.
  orbBacking?: boolean;
  // Darken sooner below the horizon, for paintings with a bright reflection
  // behind the Featured card.
  strongBottomShade?: boolean;
  // Fill for empty week-row days (default: light tint). 'solid' at night so
  // painted stars don't show through; 'faint' on bright skies.
  emptyDays?: EmptyDayFill;
}

export type EmptyDayFill = 'default' | 'solid' | 'faint';

const PAINTED_HORIZON = 925 / 1844;
const DRAWN_HORIZON = 0.4;
// Paintings are shifted up (cropping sky only) so their horizon lands here,
// as a share of screen height. Never shifted down.
export const PAINTED_HORIZON_ON_SCREEN = 0.44;

export const SCENES: Record<DayPhase, Scene> = {
  morning: {
    image: require('./images/home-morning.jpg'),
    imageBottom: '#010921',
    horizon: PAINTED_HORIZON,
    sky: ['#121a3a', '#28386a', '#6d7aa8', '#e8a77e'],
    water: ['#33416f', '#162042', '#0a1027'],
    farHills: '#4a5a8c',
    nearHills: '#273562',
    light: { kind: 'sun', color: '#ffd9a0', glow: 0.55 },
  },
  afternoon: {
    image: require('./images/home-afternoon.jpg'),
    imageBottom: '#00061d',
    horizon: PAINTED_HORIZON,
    sky: ['#15306a', '#2d58a3', '#78a3d6', '#d6e3ee'],
    water: ['#36639f', '#183568', '#0a1530'],
    farHills: '#4d71a8',
    nearHills: '#2a4a82',
    light: { kind: 'sun', color: '#fff1c2', glow: 0.45 },
    // The blue orb sits on a mid-blue sky here and loses its edge without it.
    orbBacking: true,
    // The golden lake reflection sits right behind the Featured card.
    strongBottomShade: true,
    // The default tint reads as dark dots on this bright sky.
    emptyDays: 'faint',
  },
  evening: {
    image: require('./images/home-evening.jpg'),
    imageBottom: '#00051d',
    horizon: PAINTED_HORIZON,
    sky: ['#151536', '#392c69', '#985a86', '#f0956a'],
    water: ['#3d2e60', '#1a1838', '#0a0a1d'],
    farHills: '#4b3b73',
    nearHills: '#29224f',
    light: { kind: 'sun', color: '#ffb47c', glow: 0.6 },
  },
  night: {
    // From home-night3.png (moon ~30% across, 25% down, clear of the name and
    // week row). home-night.png and home-night2.png are not used.
    image: require('./images/home-night.jpg'),
    imageBottom: '#000519',
    emptyDays: 'solid',
    horizon: PAINTED_HORIZON,
    sky: ['#05081a', '#0a1232', '#16225a', '#2a3876'],
    water: ['#152050', '#0a1030', '#05081a'],
    farHills: '#1b2752',
    nearHills: '#0d1535',
    light: { kind: 'moon', color: '#dfe6ff', glow: 0.18 },
  },
};

// The scene's horizon as a share of its own height (drawn fallback: 40%).
export function sceneHorizon(scene: Scene): number {
  return scene.image ? scene.horizon : DRAWN_HORIZON;
}

// How a painting is placed: scaled to cover the screen and centred
// horizontally, then shifted up (cropping only sky) so its horizon lands at
// PAINTED_HORIZON_ON_SCREEN. It is never zoomed further and never shifted
// down; the strip it leaves at the bottom is filled with its own bottom colour.
export function imageFrame(scene: Scene, w: number, h: number) {
  const { width: iw, height: ih } = Image.resolveAssetSource(scene.image!);
  const scale = Math.max(w / iw, h / ih);
  const width = iw * scale;
  const height = ih * scale;
  const top = Math.min(0, h * PAINTED_HORIZON_ON_SCREEN - height * sceneHorizon(scene));
  return { width, height, left: (w - width) / 2, top };
}

// Where the horizon lands on screen, in points from the top, for a phase.
export function horizonOnScreen(phase: DayPhase, w: number, h: number): number {
  const scene = SCENES[phase];
  if (scene.image) {
    const frame = imageFrame(scene, w, h);
    return frame.top + frame.height * sceneHorizon(scene);
  }
  return h * sceneHorizon(scene);
}
