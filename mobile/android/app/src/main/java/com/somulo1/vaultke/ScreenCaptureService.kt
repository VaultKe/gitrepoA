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
        // We were launched with startForegroundService(), which is a promise to
        // the platform that startForeground() will follow within ~5 seconds.
        // Breaking that promise is fatal and *cannot* be caught: the system
        // kills the process with ForegroundServiceDidNotStartInTimeException.
        // So every path below has to end in a successful startForeground(),
        // even a degraded one -- the previous version caught the failure and
        // called stopSelf(), which does not satisfy the contract and so turned
        // a recoverable error into the app closing mid-meeting.
        if (!enterForeground()) {
            Log.w(TAG, "Could not enter the foreground at all; stopping")
            stopSelf()
        }

        return START_NOT_STICKY
    }

    /**
     * Returns true once the service is legally in the foreground.
     *
     * The mediaProjection type is what makes the capture legal on Android 14+,
     * so it is tried first. If the platform refuses that specific type we fall
     * back to a plain foreground service: the screen share itself may then fail
     * (WebRTC swallows that and the share comes through black), but the app
     * stays alive and the user sees a failed share instead of a crash.
     */
    private fun enterForeground(): Boolean {
        val notification = try {
            buildNotification()
        } catch (e: Exception) {
            Log.w(TAG, "Failed to build the notification: ${e.message}")
            return false
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
                return true
            } catch (e: Exception) {
                Log.w(TAG, "mediaProjection foreground type rejected: ${e.message}")
            }
        }

        return try {
            @Suppress("DEPRECATION")
            startForeground(NOTIFICATION_ID, notification)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Failed to enter the foreground: ${e.message}")
            false
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
                .setSmallIcon(SMALL_ICON)
                .setOngoing(true)
                .build()
        }

        @Suppress("DEPRECATION")
        return Notification.Builder(this)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(SMALL_ICON)
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

        // A plain system drawable, deliberately not the launcher icon. Expo's
        // launcher icon is an adaptive icon (an XML drawable), and handing one
        // of those to setSmallIcon() makes the platform reject the whole
        // notification -- which for a foreground service means the system
        // kills the app with BadForegroundServiceNotificationException the
        // moment sharing starts. A guaranteed-valid bitmap icon avoids that
        // entire class of failure.
        private val SMALL_ICON = android.R.drawable.ic_menu_camera
    }
}
