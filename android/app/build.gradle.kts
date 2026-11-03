plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Set by the GitHub build (.github/workflows/android.yml); defaults for a local build.
val siteUrl = (findProperty("graceSiteUrl") as String?) ?: "https://grace.gracebound.stream"
val buildNumber = ((findProperty("graceVersionCode") as String?) ?: "1").toInt()
val keystorePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")

android {
    namespace = "stream.gracebound.grace"
    compileSdk = 35

    defaultConfig {
        applicationId = "stream.gracebound.grace"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
        buildConfigField("String", "SITE_URL", "\"$siteUrl\"")
    }

    signingConfigs {
        create("release") {
            // The key file is in the repo; its password is a GitHub secret, so
            // only the GitHub build can sign updates that install over Grace.
            storeFile = file("../grace-release.p12")
            storeType = "PKCS12"
            storePassword = keystorePassword
            keyAlias = "grace"
            keyPassword = keystorePassword
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (keystorePassword.isNullOrEmpty()) signingConfigs.getByName("debug") else signingConfigs.getByName("release")
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        // Sideloaded app: don't fail the build on Play Store policy checks.
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("com.google.firebase:firebase-messaging:24.1.0")
}
