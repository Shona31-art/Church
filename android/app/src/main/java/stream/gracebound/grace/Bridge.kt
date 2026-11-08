package stream.gracebound.grace

import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.webkit.JavascriptInterface
import androidx.core.app.NotificationManagerCompat

/**
 * window.GraceAndroid in the website (components/AndroidBridge.tsx):
 * the phone things a web page can't do on its own.
 */
class Bridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun version(): Int = BuildConfig.VERSION_CODE

    /** This phone's push address, once Firebase is set up; "" until then. */
    @JavascriptInterface
    fun fcmToken(): String = Push.token(activity)

    /** This app version returns every file when several are picked at once (MainActivity.pickFiles). */
    @JavascriptInterface
    fun canPickMultiple(): Boolean = true

    @JavascriptInterface
    fun setBadge(count: Int) = Badge.set(activity, count)

    /** Saves a PDF/JPG/PNG the page made (base64) and opens it. Since app version with Files.kt. */
    @JavascriptInterface
    fun saveFile(name: String, mime: String, base64: String): Boolean = Files.save(activity, name, mime, base64)

    /** "voice", "video" or "none" — see CallMode. */
    @JavascriptInterface
    fun inCall(mode: String) {
        if (mode !in setOf("voice", "video", "none")) return
        activity.runOnUiThread { activity.call.set(mode) }
    }

    @JavascriptInterface
    fun setSpeaker(on: Boolean) {
        activity.runOnUiThread { activity.call.speaker(on) }
    }

    @JavascriptInterface
    fun notificationsAllowed(): Boolean = NotificationManagerCompat.from(activity).areNotificationsEnabled()

    /** Android 14+: apps from outside the Play Store need this to show a ringing call over the lock screen. */
    @JavascriptInterface
    fun fullScreenCallsAllowed(): Boolean =
        Build.VERSION.SDK_INT < 34 || activity.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()

    /** Some phones delay pushes for apps they put to sleep. */
    @JavascriptInterface
    fun batteryUnrestricted(): Boolean =
        (activity.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(activity.packageName)

    @JavascriptInterface
    fun openSettings(which: String) {
        val pkg = Uri.parse("package:" + activity.packageName)
        val intent = when (which) {
            "fullscreen" ->
                if (Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg) else null
            "battery" -> Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, pkg)
            "callsound" -> Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
                .putExtra(Settings.EXTRA_CHANNEL_ID, Notifier.CH_CALLS)
            "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
            else -> null
        } ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
        activity.runOnUiThread {
            try {
                activity.startActivity(intent)
            } catch (e: Exception) {
                activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg))
            }
        }
    }
}
