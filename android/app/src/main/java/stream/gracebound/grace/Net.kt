package stream.gracebound.grace

import android.webkit.CookieManager
import java.net.HttpURLConnection
import java.net.URL

/** Small HTTPS requests to Grace, signed in with the app's own session cookie. */
object Net {
    fun get(url: String): String? = request("GET", url, null)

    /** Returns the status code, or 0 when there was no answer. */
    fun postJson(url: String, json: String): Int {
        var code = 0
        request("POST", url, json) { code = it }
        return code
    }

    private fun request(method: String, url: String, json: String?, onCode: (Int) -> Unit = {}): String? {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = method
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Accept", "application/json")
                val cookies = try { CookieManager.getInstance().getCookie(url) } catch (e: Exception) { null }
                if (!cookies.isNullOrEmpty()) setRequestProperty("Cookie", cookies)
                if (json != null) {
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    outputStream.use { it.write(json.toByteArray()) }
                }
            }
            val code = connection.responseCode
            onCode(code)
            if (code in 200..299) connection.inputStream.bufferedReader().use { it.readText() } else null
        } catch (e: Exception) {
            null
        } finally {
            connection?.disconnect()
        }
    }
}
