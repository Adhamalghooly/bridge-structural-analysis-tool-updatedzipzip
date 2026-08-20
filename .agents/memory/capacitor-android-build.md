---
name: Capacitor Android Build
description: Environment requirements and recovery notes for producing the Android APK.
---

Capacitor 8 Android builds require Java 21, Android SDK/platform 36, and Build Tools 35/36. The checked-in Gradle wrapper may need regeneration if its jar is corrupt; running Gradle's wrapper task from a valid Gradle distribution restores it.

**Why:** The Replit workspace may have Java 19 or no Android SDK, and a corrupt wrapper prevents Gradle from even downloading its distribution.

**How to apply:** Build the web app, run Capacitor sync, ensure `android/local.properties` points to a valid SDK, use Java 21, then run `android/gradlew assembleDebug`.

The local updater stores a validated web bundle under the app's private `local-updates/current` directory and switches Capacitor's `WebViewLocalServer` to that directory. Update ZIPs must contain `index.html` at the archive root; the app also supports selecting a folder directly.

**Why:** Android APK assets are read-only, so local web updates need a writable private bundle and Capacitor's server-base-path API rather than attempting to overwrite APK assets.

**How to apply:** Use Settings → Local Update to choose a ZIP or folder. Create a new bundle with `npm run update:bundle`; native Android changes still require a new APK.