import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json is the whole config. This file only changes the app's identity for
// the development build (eas.json "development" sets APP_VARIANT), so it
// installs next to the preview and store app instead of replacing it:
// its own package, name and link scheme, and EAS gives the new package its own
// signing key. Everything else (plugins, blocked permissions, allowBackup)
// comes from app.json unchanged. Without APP_VARIANT the config is app.json
// exactly as it is.
//
// Email links always open the main app: the backend's /auth/callback page
// opens breathingapp://, so confirm and reset emails are tested on preview
// builds, not on the development app.

const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!IS_DEV) return config as ExpoConfig;
  return {
    ...config,
    name: 'Breathease Dev',
    slug: config.slug as string,
    scheme: 'breathingapp-dev',
    android: {
      ...config.android,
      package: 'com.smarttech1.breathingapp.dev',
    },
  };
};
