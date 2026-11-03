package stream.gracebound.grace

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Runs during a call so Android keeps the microphone and the call going
 * when you switch to another app, with a "call in progress" notification.
 */
class CallService : Service() {
    companion object {
        fun start(context: Context) {
            try {
                ContextCompat.startForegroundService(context, Intent(context, CallService::class.java))
            } catch (e: Exception) {
                // Not allowed right now (e.g. no microphone permission): the call still works while Grace is open.
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, CallService::class.java))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            val type = if (Build.VERSION.SDK_INT >= 30) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
            ServiceCompat.startForeground(this, Notifier.ONGOING_CALL_ID, Notifier.ongoingCall(this), type)
        } catch (e: Exception) {
            stopSelf()
        }
        return START_NOT_STICKY
    }
}
