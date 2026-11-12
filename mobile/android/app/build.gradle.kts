import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing: android/key.properties (never committed; see key.properties.example and mobile/README.md).
// Without it, release builds are signed with the debug key so they can still be tried on a phone,
// but such a build cannot be uploaded to Google Play.
val keystoreProperties = Properties()
val keystoreFile = rootProject.file("key.properties")
val hasReleaseKey = keystoreFile.exists()
if (hasReleaseKey) {
    keystoreFile.inputStream().use { keystoreProperties.load(it) }
}

// The portal's host name, for the links that open the app (must match LMS_BASE_URL in lib/config.dart)
val lmsHost = (project.findProperty("lms.host") as String?) ?: "lms.jamiaashrafia.asia"

android {
    namespace = "com.jamiaashrafia.lms"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.jamiaashrafia.lms"
        // The Jitsi Meet SDK needs Android 8.0 (API 26) or newer
        minSdk = maxOf(26, flutter.minSdkVersion)
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["lmsHost"] = lmsHost
    }

    signingConfigs {
        if (hasReleaseKey) {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "release" else "debug")
            // Code shrinking is off: the meeting SDK (React Native) is loaded by reflection and breaks at
            // run time when its classes are renamed or removed.
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

flutter {
    source = "../.."
}
