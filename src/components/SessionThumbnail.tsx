import { Image, View } from 'react-native';

import { radii } from '../theme/tokens';
import type { Session } from '../types/models';

// Real per-session illustrations, replacing the earlier `pattern`-keyed
// lookup (2026-09-19 instruction: these filenames correspond directly to
// specific sessions, not the generic `pattern` field — keyed by session
// `id` instead). library-code.html's own thumbnails are hotlinked Google
// AI Studio/"Stitch" preview images (lh3.googleusercontent.com/aida-public/
// ...) — design-tool session URLs, not assets this project owns or has a
// confirmed production license for, so they were never bundled. Using the
// real, project-owned illustrations in assets/illustrations/ instead.
//
// `w`/`h`/`contentBox` (found 2026-09-19, fixing an off-center/undersized
// thumbnail bug): the 6 supplied PNGs are NOT uniformly framed — each has
// a different amount of transparent padding around its actual glowing-orb
// artwork, and deep-exhale's artwork isn't even centered within its own
// canvas. Plain `resizeMode="cover"` scales the whole canvas (padding
// included), so images with more padding — or off-center content — render
// visibly smaller/off-center than the others even inside an identically
// sized container. `contentBox` is each image's real content bounding box
// in source pixels (measured via PIL: `Image.open(f).getchannel('A')
// .point(lambda a: 255 if a > 30 else 0).getbbox()`), used below to scale
// and translate each image so its actual artwork — not its raw canvas —
// fills the thumbnail consistently. Re-measure and update these if any of
// these source files are replaced again.
const SESSION_IMAGES: Record<
  string,
  { source: ReturnType<typeof require>; w: number; h: number; contentBox: [number, number, number, number] }
> = {
  'deep-exhale': {
    source: require('../../assets/illustrations/deepexhale.png'),
    w: 230,
    h: 230,
    contentBox: [31, 32, 230, 230],
  },
  'morning-reset': {
    source: require('../../assets/illustrations/morningreset.png'),
    w: 200,
    h: 200,
    contentBox: [0, 0, 200, 200],
  },
  'calm-focus': {
    source: require('../../assets/illustrations/calmfocus.png'),
    w: 433,
    h: 429,
    contentBox: [21, 60, 394, 391],
  },
  'stress-relief': {
    source: require('../../assets/illustrations/stressrelief.png'),
    w: 430,
    h: 428,
    contentBox: [80, 81, 353, 350],
  },
  'wind-down': {
    source: require('../../assets/illustrations/winddown.png'),
    w: 431,
    h: 429,
    contentBox: [62, 69, 374, 374],
  },
  'box-breathing': {
    source: require('../../assets/illustrations/boxbreathing.png'),
    w: 430,
    h: 426,
    contentBox: [33, 31, 406, 393],
  },
};

export function SessionThumbnail({
  sessionId,
  size = 80,
}: {
  sessionId: Session['id'];
  size?: number;
}) {
  const meta = SESSION_IMAGES[sessionId];

  return (
    <View style={{ width: size, height: size, borderRadius: radii.xl, overflow: 'hidden' }}>
      {meta &&
        (() => {
          const [x0, y0, x1, y1] = meta.contentBox;
          const contentW = x1 - x0;
          const contentH = y1 - y0;
          const contentCx = (x0 + x1) / 2;
          const contentCy = (y0 + y1) / 2;
          // Scale the whole image so its content box (not its canvas) covers `size`.
          const scale = Math.max(size / contentW, size / contentH);
          return (
            <Image
              source={meta.source}
              resizeMode="cover"
              style={{
                position: 'absolute',
                width: meta.w * scale,
                height: meta.h * scale,
                left: size / 2 - contentCx * scale,
                top: size / 2 - contentCy * scale,
              }}
            />
          );
        })()}
    </View>
  );
}
