package stream.gracebound.grace

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.content.ContextCompat

/** Grace's pop-ups: ringing calls, messages, and everything else. */
object Notifier {
    const val CH_CALLS = "calls"
    const val CH_MESSAGES = "messages"
    const val CH_GENERAL = "general"
    const val CH_ONGOING = "ongoing_call"
    const val ONGOING_CALL_ID = 4242
    private const val CALL_TAG = "call"
    /** How long a call rings before it counts as missed (the website gives up after 45 s too). */
    private const val RING_MS = 45_000L

    fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        val ringing = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        nm.createNotificationChannels(
            listOf(
                // The phone's own ringtone, at ringer volume. Change it under
                // Settings → Apps → Grace → Notifications → Calls → Sound.
                NotificationChannel(CH_CALLS, "Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Incoming voice and video calls"
                    setSound(ringtone, ringing)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 800, 600, 800, 600)
                    lockscreenVisibility = Notification.VISIBILITY_PUBLIC
                },
                NotificationChannel(CH_MESSAGES, "Messages", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Chat messages"
                    setShowBadge(true)
                },
                NotificationChannel(CH_GENERAL, "Church news and reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    setShowBadge(true)
                },
                NotificationChannel(CH_ONGOING, "Call in progress", NotificationManager.IMPORTANCE_LOW).apply {
                    setShowBadge(false)
                },
            )
        )
    }

    private fun flags() = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT

    /** Calls already answered, declined or ended here: a late repeat of the ring is ignored. */
    private fun isHandled(context: Context, callId: String) =
        Push.prefs(context).getStringSet("handled_calls", emptySet())!!.contains(callId)

    fun markHandled(context: Context, callId: String) {
        val p = Push.prefs(context)
        val set = p.getStringSet("handled_calls", emptySet())!!.toMutableList()
        set.add(callId)
        p.edit().putStringSet("handled_calls", set.takeLast(30).toSet()).apply()
    }

    fun showCall(context: Context, callId: String, caller: String, video: Boolean, link: String) {
        if (isHandled(context, callId)) return
        // Grace is open on screen: the website rings and shows the call itself.
        if (MainActivity.visible) return
        val id = callId.hashCode()
        val callUrl = absolute(link)
        val full = PendingIntent.getActivity(
            context, id,
            Intent(context, IncomingCallActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
                .putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId)
                .putExtra(IncomingCallActivity.EXTRA_CALLER, caller)
                .putExtra(IncomingCallActivity.EXTRA_VIDEO, video)
                .putExtra(IncomingCallActivity.EXTRA_URL, callUrl),
            flags()
        )
        val answer = PendingIntent.getActivity(context, id + 1, answerIntent(context, callId, callUrl), flags())
        val decline = PendingIntent.getBroadcast(
            context, id + 2,
            Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_DECLINE).putExtra(IncomingCallActivity.EXTRA_CALL_ID, callId),
            flags()
        )
        val person = Person.Builder().setName(caller).setImportant(true).build()
        val notification = NotificationCompat.Builder(context, CH_CALLS)
            .setSmallIcon(R.drawable.ic_stat_grace)
            .setColor(ContextCompat.getColor(context, R.color.grace_accent))
            .setContentTitle(caller)
            .setContentText(if (video) "Incoming video call" else "Incoming voice call")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(full, true)
            .setContentIntent(full)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(RING_MS)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(person, decline, answer).setIsVideo(video))
            .build()
        // Keeps ringing until answered, declined or the caller gives up.
        notification.flags = notification.flags or Notification.FLAG_INSISTENT
        notify(context, CALL_TAG, id, notification)
    }

    fun answerIntent(context: Context, callId: String, callUrl: String): Intent =
        Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(MainActivity.EXTRA_URL, withGo(callUrl))
            .putExtra(MainActivity.EXTRA_ANSWER_CALL, callId)

    /** Stops the ringing for this call (answered, declined, or the caller hung up). */
    fun cancelCall(context: Context, callId: String) {
        markHandled(context, callId)
        context.getSystemService(NotificationManager::class.java).cancel(CALL_TAG, callId.hashCode())
        IncomingCallActivity.closeFor(callId)
    }

    /** A message or other notice. `data` is the push from the server. */
    fun showNotice(context: Context, data: Map<String, String>) {
        val title = data["title"] ?: "Grace"
        val body = data["body"] ?: ""
        val message = data["kind"] == "message"
        val tag = data["tag"] ?: data["url"] ?: title
        val open = PendingIntent.getActivity(
            context, tag.hashCode(),
            Intent(context, MainActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(MainActivity.EXTRA_URL, absolute(data["url"] ?: "/dashboard")),
            flags()
        )
        val builder = NotificationCompat.Builder(context, if (message) CH_MESSAGES else CH_GENERAL)
            .setSmallIcon(R.drawable.ic_stat_grace)
            .setColor(ContextCompat.getColor(context, R.color.grace_accent))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(if (message) NotificationCompat.CATEGORY_MESSAGE else NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setWhen(System.currentTimeMillis())
            .setShowWhen(true)
        data["badge"]?.toIntOrNull()?.let { builder.setNumber(it) }
        notify(context, "n", tag.hashCode(), builder.build())
    }

    fun ongoingCall(context: Context): Notification {
        val open = PendingIntent.getActivity(
            context, ONGOING_CALL_ID,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            flags()
        )
        return NotificationCompat.Builder(context, CH_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_grace)
            .setColor(ContextCompat.getColor(context, R.color.grace_accent))
            .setContentTitle("Grace call in progress")
            .setContentText("Tap to return to the call")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setContentIntent(open)
            .setOngoing(true)
            .setUsesChronometer(true)
            .build()
    }

    private fun notify(context: Context, tag: String, id: Int, notification: Notification) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) return
        context.getSystemService(NotificationManager::class.java).notify(tag, id, notification)
    }

    /** Links from the server are paths like /dashboard/chat/…; only Grace's own pages open. */
    fun absolute(link: String): String =
        if (link.startsWith("/") && !link.startsWith("//")) BuildConfig.SITE_URL + link else BuildConfig.SITE_URL + "/dashboard"

    private fun withGo(url: String) = if (url.contains("?")) "$url&go=1" else "$url?go=1"
}
