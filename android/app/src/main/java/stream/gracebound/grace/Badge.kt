package stream.gracebound.grace

import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import android.os.Bundle

/**
 * The number on Grace's app icon. Most phones count Grace's notifications
 * (and the number set on them); Huawei and Honor launchers also take the
 * number directly.
 */
object Badge {
    fun set(context: Context, count: Int) {
        val n = count.coerceAtLeast(0)
        Push.prefs(context).edit().putInt("badge", n).apply()
        val launcher = context.packageManager.getLaunchIntentForPackage(context.packageName)?.component?.className ?: return
        val extras = Bundle().apply {
            putString("package", context.packageName)
            putString("class", launcher)
            putInt("badgenumber", n)
        }
        for (authority in listOf("com.huawei.android.launcher.settings", "com.hihonor.android.launcher.settings")) {
            try {
                context.contentResolver.call(Uri.parse("content://$authority/badge/"), "change_badge", null, extras)
            } catch (e: Exception) {
                // Not that kind of phone.
            }
        }
        if (n == 0) {
            // Everything's read: clear message pop-ups too (not a ringing call).
            val nm = context.getSystemService(NotificationManager::class.java)
            nm.activeNotifications
                .filter { it.notification.channelId != Notifier.CH_CALLS && it.id != Notifier.ONGOING_CALL_ID }
                .forEach { nm.cancel(it.tag, it.id) }
        }
    }

    fun current(context: Context): Int = Push.prefs(context).getInt("badge", 0)
}
