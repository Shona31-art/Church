package stream.gracebound.grace

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

/** "Decline" on the ringing call: stop ringing and tell the caller. */
class CallActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_DECLINE = "stream.gracebound.grace.DECLINE"

        fun decline(context: Context, callId: String) {
            Notifier.cancelCall(context, callId)
            Thread {
                Net.postJson("${BuildConfig.SITE_URL}/api/calls/decline", JSONObject().put("callId", callId).toString())
            }.start()
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION_DECLINE) return
        val callId = intent.getStringExtra(IncomingCallActivity.EXTRA_CALL_ID) ?: return
        val pending = goAsync()
        Notifier.cancelCall(context, callId)
        Thread {
            try {
                Net.postJson("${BuildConfig.SITE_URL}/api/calls/decline", JSONObject().put("callId", callId).toString())
            } finally {
                pending.finish()
            }
        }.start()
    }
}
