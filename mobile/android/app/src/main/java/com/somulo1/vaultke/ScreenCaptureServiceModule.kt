package com.somulos.vaultke

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS bridge for {@link ScreenCaptureService}.
 *
 * The service has to be running *before* `getDisplayMedia()` is called, because
 * react-native-webrtc starts the screen capturer as soon as the user accepts the
 * system capture prompt.
 */
class ScreenCaptureServiceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun start(promise: Promise) {
        try {
            val context = reactApplicationContext
            val intent = Intent(context, ScreenCaptureService::class.java)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("screen_capture_service_start_failed", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            val context = reactApplicationContext
            context.stopService(Intent(context, ScreenCaptureService::class.java))
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("screen_capture_service_stop_failed", e)
        }
    }

    companion object {
        const val NAME = "ScreenCaptureService"
    }
}
