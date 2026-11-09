/**
 * Pouch — withNoSplash.
 *
 * Removes the branded loading window Android shows while the JS bundle
 * boots. Expo's prebuild template always stamps the launcher activity with
 * `Theme.App.SplashScreen` (a `windowBackground` logo), even when app.json
 * has no `splash` configuration at all — deleting the config key is not
 * enough. This plugin repoints the launcher activity at the plain
 * `AppTheme`, so the app window is on screen immediately with no splash
 * logo and no separate loading window.
 *
 * Note: Android 12+ still flashes its brief OS-level system splash on cold
 * start — no app can opt out of that — but the app-side window is gone.
 *
 * @param {import('@expo/config-types').ExpoConfig} config
 * @returns {import('@expo/config-types').ExpoConfig}
 */
const { AndroidConfig, withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withNoSplash(config) {
  return withAndroidManifest(config, (modConfig) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      modConfig.modResults,
    );
    mainActivity.$['android:theme'] = '@style/AppTheme';
    return modConfig;
  });
};
