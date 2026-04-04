###############################################################################
# R8 FULL MODE – smaller APK, better dead-code elimination
###############################################################################
-allowaccessmodification
-repackageclasses ''

###############################################################################
# REQUIRED RULES – FIX R8 CRASH FOR RELEASE BUILD
###############################################################################

# VisionCamera
-keep class com.mrousavy.camera.** { *; }
-keepclassmembers class com.mrousavy.camera.** { *; }

# MLKit Barcode / Code Scanner (required for VisionCamera code scanning)
-keep class com.google.mlkit.** { *; }
-keep interface com.google.mlkit.** { *; }
-keepclassmembers class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Google Play Services MLKit (barcode scanning uses this too)
-keep class com.google.android.gms.internal.mlkit_vision_barcode.** { *; }
-dontwarn com.google.android.gms.internal.mlkit_vision_barcode.**
-keep class com.google.android.gms.vision.** { *; }
-dontwarn com.google.android.gms.vision.**

# React Native Core + Hermes
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.hermes.**
-dontwarn com.facebook.react.**

# Reanimated
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# JSI / TurboModules (Required for Vision Camera)
-keep class com.swmansion.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Keep JNI native methods
-keepclasseswithmembers class * {
    native <methods>;
}

# Stop warnings for annotations
-keep class androidx.annotation.** { *; }
-dontwarn javax.annotation.**

###############################################################################
