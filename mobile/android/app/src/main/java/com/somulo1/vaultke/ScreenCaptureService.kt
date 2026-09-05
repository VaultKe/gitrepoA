package com.somulos.vaultke

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * Foreground service that hosts MediaProjection while a meeting participant is
 * sharing their screen.
 *
 * Android 14 (API 34) refuses to create the capture virtual display unless a
 * foreground service of type `mediaProjection` is already running, and
 * react-native-webrtc swallows the resulting SecurityException
 * (AbstractVideoCaptureController.startCapture catches RuntimeException). The
 * result is a screen track that resolves successfully but never produces a
 * single frame, so remote participants receive a black video while the sharer
 * believes the share is live. Keeping this service alive for the duration of
 * the share is what makes the capture legal.
 */
class ScreenCaptureService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            startForegroundCompat(NOTIFICATION_ID, buildNotification())
        } catch (e: Exception) {
            // Starting the service is best effort: if the platform rejects it we
            // still let the capture attempt proceed so the user gets the real
            // error from WebRTC instead of a silent no-op.
            Log.w(TAG, "Failed to enter the foreground: ${e.message}")
            stopSelf()
            return START_NOT_STICKY
        }

        return START_NOT_STICKY
    }

    private fun startForegroundCompat(id: Int, notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(id, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            @Suppress("DEPRECATION")
            super.startForeground(id, notification)
        }
    }

    private fun buildNotification(): Notification {
        val title = "Screen sharing active"
        val text = "$appLabel is sharing your screen with the meeting"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Screen sharing",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.setShowBadge(false)
            manager?.createNotificationChannel(channel)

            return Notification.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(applicationInfo.icon)
                .setOngoing(true)
                .build()
        }

        @Suppress("DEPRECATION")
        return Notification.Builder(this)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .setPriority(Notification.PRIORITY_LOW)
            .build()
    }

    private val appLabel: String
        get() = applicationInfo.loadLabel(packageManager).toString()

    companion object {
        private const val TAG = "ScreenCaptureService"
        private const val CHANNEL_ID = "screen_capture"
        private const val NOTIFICATION_ID = 4242
    }
}
