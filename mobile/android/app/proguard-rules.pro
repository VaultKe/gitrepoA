# ----------------------------------------------------------------------------
# ProGuard / R8 Rules for VaultKe
# ----------------------------------------------------------------------------

# --- Kotlin ---
-keepclassmembers class kotlin.Metadata { *; }
-keep class kotlin.Metadata { *; }
-assumenosideeffects class kotlin.jvm.internal.Intrinsics {
    static void checkNotNullArgument(java.lang.Object);
    static void checkNotNullArgument(java.lang.Object, java.lang.String);
}

# --- React Native / Expo ---
-keep class com.facebook.react.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class expo.** { *; }
-keep class expo.modules.** { *; }

# --- Native methods ---
-keepclasseswithmembernames class * {
    native <methods>;
}

# --- Enums ---
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# --- Generics ---
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod
-keepattributes EnclosingClass
-keepattributes InnerClasses

# --- Keep our app classes ---
-keep class com.somulos.vaultke.** { *; }

# --- Keep API endpoint interfaces (reflection) ---
-keep class com.somulos.vaultke.api.** { *; }

# --- Keep Parcelable / Serializable ---
-keep class * implements android.os.Parcelable {
    *;
}
-keep class * implements java.io.Serializable {
    *;
}

# --- Keep Dagger/Hilt (if used) ---
-keep class dagger.** { *; }

# --- Suppress warnings ---
-dontwarn com.facebook.react.**
-dontwarn expo.**
-dontwarn com.somulos.vaultke.**
