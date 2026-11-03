package stream.gracebound.grace

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference

/** Full screen over the lock screen while someone calls: Decline / Answer, like WhatsApp. */
class IncomingCallActivity : Activity() {
    companion object {
        const val EXTRA_CALL_ID = "callId"
        const val EXTRA_CALLER = "caller"
        const val EXTRA_VIDEO = "video"
        const val EXTRA_URL = "url"
        private var current: WeakReference<IncomingCallActivity>? = null

        /** The caller hung up or the call was answered elsewhere. */
        fun closeFor(callId: String) {
            Handler(Looper.getMainLooper()).post {
                current?.get()?.let { if (it.callId == callId) it.finish() }
            }
        }
    }

    private var callId: String = ""
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        callId = intent.getStringExtra(EXTRA_CALL_ID) ?: return finish()
        val caller = intent.getStringExtra(EXTRA_CALLER) ?: "Grace"
        val video = intent.getBooleanExtra(EXTRA_VIDEO, false)
        val url = intent.getStringExtra(EXTRA_URL) ?: (BuildConfig.SITE_URL + "/dashboard/calls/" + callId)
        current = WeakReference(this)

        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        val density = resources.displayMetrics.density
        fun dp(v: Int) = (v * density).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.parseColor("#0B1F1A"))
            setPadding(dp(24), dp(96), dp(24), dp(64))
        }
        val initial = TextView(this).apply {
            text = caller.trim().take(1).uppercase()
            setTextColor(Color.WHITE)
            textSize = 44f
            gravity = Gravity.CENTER
            typeface = Typeface.DEFAULT_BOLD
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.parseColor("#2FA3B0")) }
        }
        root.addView(initial, LinearLayout.LayoutParams(dp(112), dp(112)))
        root.addView(TextView(this).apply {
            text = caller
            setTextColor(Color.WHITE)
            textSize = 28f
            gravity = Gravity.CENTER
            setPadding(0, dp(24), 0, dp(8))
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        root.addView(TextView(this).apply {
            text = if (video) "Grace video call" else "Grace voice call"
            setTextColor(Color.parseColor("#B3FFFFFF"))
            textSize = 16f
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        // Push the buttons to the bottom.
        root.addView(android.view.View(this), LinearLayout.LayoutParams(1, 0, 1f))

        val buttons = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        fun round(label: String, color: String, onTap: () -> Unit) = Button(this).apply {
            text = label
            setTextColor(Color.WHITE)
            textSize = 16f
            isAllCaps = false
            background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.parseColor(color)) }
            setOnClickListener { onTap() }
        }
        val decline = round("Decline", "#E5484D") {
            CallActionReceiver.decline(this, callId)
            finish()
        }
        val answer = round("Answer", "#16A34A") {
            Notifier.cancelCall(this, callId)
            startActivity(Notifier.answerIntent(this, callId, url))
            finish()
        }
        buttons.addView(decline, LinearLayout.LayoutParams(dp(88), dp(88)).apply { marginEnd = dp(72) })
        buttons.addView(answer, LinearLayout.LayoutParams(dp(88), dp(88)))
        root.addView(buttons, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

        setContentView(root)
        // Stop showing once the ring would have timed out.
        handler.postDelayed({ finish() }, 46_000)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        if (current?.get() === this) current = null
        super.onDestroy()
    }
}
