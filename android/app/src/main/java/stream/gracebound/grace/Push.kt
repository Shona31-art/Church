package stream.gracebound.grace

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject

/**
 * Firebase Cloud Messaging (free) wakes the app for calls and messages.
 * Its settings aren't built into the app: they come from the website
 * (/api/android/config, filled in from Vercel), so the app works before
 * Firebase is set up and starts ringing as soon as it is.
 */
object Push {
    private const val TAG = "GracePush"

    fun prefs(context: Context): SharedPreferences = context.getSharedPreferences("grace", Context.MODE_PRIVATE)

    /** Starts Firebase from saved settings. True when push is ready. */
    fun start(context: Context): Boolean {
        if (FirebaseApp.getApps(context).isNotEmpty()) return true
        val p = prefs(context)
        val appId = p.getString("fb_app_id", null) ?: return false
        val apiKey = p.getString("fb_api_key", null) ?: return false
        val projectId = p.getString("fb_project_id", null) ?: return false
        val senderId = p.getString("fb_sender_id", null) ?: return false
        return try {
            val options = FirebaseOptions.Builder()
                .setApplicationId(appId)
                .setApiKey(apiKey)
                .setProjectId(projectId)
                .setGcmSenderId(senderId)
                .build()
            FirebaseApp.initializeApp(context, options)
            true
        } catch (e: Exception) {
            Log.w(TAG, "Firebase didn't start", e)
            false
        }
    }

    /** Background thread: fetch the settings from the website, start Firebase, get this phone's token. */
    fun refresh(context: Context, onToken: (String) -> Unit) {
        val body = Net.get("${BuildConfig.SITE_URL}/api/android/config")
        if (body != null) {
            try {
                val o = JSONObject(body)
                if (o.optBoolean("enabled")) {
                    prefs(context).edit()
                        .putString("fb_app_id", o.getString("appId"))
                        .putString("fb_api_key", o.getString("apiKey"))
                        .putString("fb_project_id", o.getString("projectId"))
                        .putString("fb_sender_id", o.getString("senderId"))
                        .apply()
                }
            } catch (e: Exception) {
                Log.w(TAG, "Bad push settings from the site", e)
            }
        }
        if (!start(context)) return
        try {
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                val token = if (task.isSuccessful) task.result else null
                if (!token.isNullOrEmpty()) {
                    prefs(context).edit().putString("fcm_token", token).apply()
                    onToken(token)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "No push token", e)
        }
    }

    fun token(context: Context): String = prefs(context).getString("fcm_token", null) ?: ""
}
