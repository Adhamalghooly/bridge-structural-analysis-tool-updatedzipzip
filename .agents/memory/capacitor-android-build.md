---
name: Capacitor Android Build
description: Environment requirements and recovery notes for producing the Android APK.
---

Capacitor 8 Android builds require Java 21, Android SDK/platform 36, and Build Tools 35/36. The checked-in Gradle wrapper may need regeneration if its jar is corrupt; running Gradle's wrapper task from a valid Gradle distribution restores it.

**Why:** The Replit workspace may have Java 19 or no Android SDK, and a corrupt wrapper prevents Gradle from even downloading its distribution.

**How to apply:** Build the web app, run Capacitor sync, ensure `android/local.properties` points to a valid SDK, use Java 21, then run `android/gradlew assembleDebug`.