package stream.gracebound.grace

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat

/** Grace itself: the website, full screen, with the phone's camera, microphone, files and notifications. */
class MainActivity : ComponentActivity() {
    companion object {
        const val EXTRA_URL = "url"
        const val EXTRA_ANSWER_CALL = "answerCall"
        /** Grace is on screen: the website rings for calls itself. */
        @Volatile var visible = false
    }

    lateinit var web: WebView
    private lateinit var root: FrameLayout
    private var fullScreenView: View? = null
    private var pendingPermission: PermissionRequest? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    val call = CallMode(this)

    private val mediaPermissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        val request = pendingPermission ?: return@registerForActivityResult
        pendingPermission = null
        val allowed = webResourcesAllowed(request.resources)
        if (allowed.isEmpty()) request.deny() else request.grant(allowed)
    }
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}
    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        fileCallback = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = true

        root = FrameLayout(this).apply { setBackgroundColor(Color.parseColor("#FDF7F8")) }
        web = WebView(this)
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
        // Keep Grace clear of the status bar, navigation bar and keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }

        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            setSupportMultipleWindows(true)
            javaScriptCanOpenWindowsAutomatically = false
            userAgentString = "$userAgentString GraceAndroid/${BuildConfig.VERSION_CODE}"
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, true)
        }
        web.addJavascriptInterface(Bridge(this), "GraceAndroid")
        web.webViewClient = GraceWebClient()
        web.webChromeClient = GraceChromeClient()
        web.setDownloadListener { url, _, _, _, _ -> openOutside(Uri.parse(url)) }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    fullScreenView != null -> web.webChromeClient?.onHideCustomView()
                    web.canGoBack() -> web.goBack()
                    else -> moveTaskToBack(true)
                }
            }
        })

        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        if (web.url == null) web.loadUrl(startUrl(intent))
        handleCallIntent(intent)

        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        // Push settings and this phone's token, then tell the website.
        Thread {
            Push.refresh(applicationContext) { runOnUiThread { tellWebsite("grace-android-token") } }
        }.start()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val url = intent.getStringExtra(EXTRA_URL) ?: intent.dataString
        if (url != null && isGrace(Uri.parse(url))) web.loadUrl(url)
        handleCallIntent(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        visible = true
        tellWebsite("grace-android-resume")
    }

    override fun onPause() {
        visible = false
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onDestroy() {
        call.set("none")
        web.destroy()
        super.onDestroy()
    }

    private fun startUrl(intent: Intent): String {
        val url = intent.getStringExtra(EXTRA_URL) ?: intent.dataString
        return if (url != null && isGrace(Uri.parse(url))) url else BuildConfig.SITE_URL + "/dashboard"
    }

    /** Answered from the ringing screen: show the call even over the lock screen. */
    private fun handleCallIntent(intent: Intent) {
        val callId = intent.getStringExtra(EXTRA_ANSWER_CALL) ?: return
        Notifier.cancelCall(this, callId)
        showOverLockScreen(true)
    }

    fun showOverLockScreen(on: Boolean) {
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(on)
            setTurnScreenOn(on)
        } else {
            @Suppress("DEPRECATION")
            val flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            if (on) window.addFlags(flags) else window.clearFlags(flags)
        }
    }

    /** A small event the website listens for (components/AndroidBridge.tsx). */
    fun tellWebsite(event: String) {
        if (::web.isInitialized) web.evaluateJavascript("window.dispatchEvent(new Event('$event'))", null)
    }

    fun isGrace(uri: Uri): Boolean {
        val site = Uri.parse(BuildConfig.SITE_URL)
        return uri.scheme == "https" && uri.host == site.host
    }

    /** Payments open inside the app so they come back to Grace afterwards. */
    private fun staysInside(uri: Uri): Boolean {
        val host = uri.host ?: return false
        return isGrace(uri) || host.endsWith("paystack.com") || host.endsWith("paystack.co")
    }

    fun openOutside(uri: Uri) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            // Nothing on the phone can open it.
        }
    }

    private fun webResourcesAllowed(resources: Array<String>): Array<String> = resources.filter {
        when (it) {
            PermissionRequest.RESOURCE_VIDEO_CAPTURE -> granted(Manifest.permission.CAMERA)
            PermissionRequest.RESOURCE_AUDIO_CAPTURE -> granted(Manifest.permission.RECORD_AUDIO)
            else -> false
        }
    }.toTypedArray()

    private fun granted(permission: String) = ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    private inner class GraceWebClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            if (!request.isForMainFrame) return false
            val uri = request.url
            if (uri.scheme == "https" && staysInside(uri)) return false
            openOutside(uri)
            return true
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame) return
            val retry = request.url.toString().replace("'", "%27")
            view.loadDataWithBaseURL(
                null,
                """<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
                <body style="font-family:sans-serif;background:#FDF7F8;color:#2a1730;display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center;padding:24px">
                <h2>You're offline</h2><p>Grace needs the internet. Check your connection, then try again.</p>
                <button style="font-size:17px;padding:12px 28px;border-radius:999px;border:0;background:#2FA3B0;color:#fff" onclick="location.href='$retry'">Try again</button></body>""",
                "text/html", "utf-8", null
            )
        }
    }

    private inner class GraceChromeClient : WebChromeClient() {
        override fun onPermissionRequest(request: PermissionRequest) {
            runOnUiThread {
                if (!isGrace(request.origin)) return@runOnUiThread request.deny()
                val needed = request.resources.mapNotNull {
                    when (it) {
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
                        else -> null
                    }
                }.filterNot { granted(it) }
                if (needed.isEmpty()) {
                    val allowed = webResourcesAllowed(request.resources)
                    if (allowed.isEmpty()) request.deny() else request.grant(allowed)
                } else {
                    pendingPermission?.deny()
                    pendingPermission = request
                    mediaPermissions.launch(needed.toTypedArray())
                }
            }
        }

        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = callback
            return try {
                pickFiles.launch(params.createIntent())
                true
            } catch (e: ActivityNotFoundException) {
                fileCallback = null
                false
            }
        }

        // Links opened in a new tab (target=_blank): Grace pages here, others outside.
        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
            val probe = WebView(this@MainActivity)
            probe.webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                    if (isGrace(request.url)) web.loadUrl(request.url.toString()) else openOutside(request.url)
                    v.destroy()
                    return true
                }
            }
            (resultMsg.obj as WebView.WebViewTransport).webView = probe
            resultMsg.sendToTarget()
            return true
        }

        // Full-screen video (sermons).
        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            fullScreenView = view
            root.addView(view, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }

        override fun onHideCustomView() {
            fullScreenView?.let { root.removeView(it) }
            fullScreenView = null
        }
    }
}
