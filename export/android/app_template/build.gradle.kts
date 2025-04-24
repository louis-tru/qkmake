import com.android.build.gradle.internal.tasks.getTestOnlyNativeLibs
import org.gradle.internal.declarativedsl.parsing.main

plugins {
	alias(libs.plugins.android.application)
}

android {
	namespace = "{id}"
	compileSdk = 35

	defaultConfig {
		applicationId = "{id}"
		minSdk = 28
		targetSdk = 35
		versionCode = 1
		versionName = "1.0"
		testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
		externalNativeBuild.cmake {
			cppFlags += "-std=c++14"
			abiFilters += setOf("x86_64", "arm64-v8a")
		}
	}

	buildTypes {
		release {
			isMinifyEnabled = false
			proguardFiles(
				getDefaultProguardFile("proguard-android-optimize.txt"),
				"proguard-rules.pro"
			)
		}
	}
	compileOptions {
		sourceCompatibility = JavaVersion.VERSION_11
		targetCompatibility = JavaVersion.VERSION_11
	}
	buildFeatures {
		viewBinding = true
	}
	sourceSets {
		getByName("main") {
			java.srcDirs(
				"src/main/java",
			)
			jniLibs.srcDirs(
				"src/main/jniLibs",
				"../../../out/usr/android/jniLibs",
			)
			assets.srcDirs(
				"../../../out/small",
			)
		}
	}
}

dependencies {
	implementation(libs.appcompat)
	implementation(libs.material)
	implementation(libs.constraintlayout)
	testImplementation(libs.junit)
	androidTestImplementation(libs.ext.junit)
	androidTestImplementation(libs.espresso.core)
	implementation(fileTree(mapOf("dir" to "../../../out/usr/android/libs", "include" to listOf("*.jar"))))
}
