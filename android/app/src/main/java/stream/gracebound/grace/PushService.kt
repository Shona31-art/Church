package stream.gracebound.grace

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** Receives Grace's pushes, even when the app is closed. */
class PushService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // The website picks it up next time Grace is open (GraceAndroid.fcmToken()).
        Push.prefs(this).edit().putString("fcm_token", token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        when (data["type"]) {
            "call" -> {
                val callId = data["callId"] ?: return
                Notifier.showCall(this, callId, data["title"] ?: "Grace", data["video"] == "1", data["url"] ?: "/dashboard/calls/$callId")
            }
            "call_end" -> data["callId"]?.let { Notifier.cancelCall(this, it) }
            "badge" -> Unit
            else -> Notifier.showNotice(this, data)
        }
        data["badge"]?.toIntOrNull()?.let { Badge.set(this, it) }
    }
}
