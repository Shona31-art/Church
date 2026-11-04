package stream.gracebound.grace

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.widget.Toast
import androidx.core.content.FileProvider
import java.io.File

/**
 * Saving a file the website made (a certificate or poster as PDF/JPG): the
 * WebView can't download "blob:" files or print, so the page hands the bytes
 * to window.GraceAndroid.saveFile. Android 10+: saved in Downloads. Older
 * phones: kept in the app's cache. Either way it then opens, so it can be
 * viewed, printed or shared from the phone's viewer.
 */
object Files {
    private val SAFE_NAME = Regex("[^A-Za-z0-9 ._()-]")

    fun save(activity: MainActivity, name: String, mime: String, base64: String): Boolean {
        if (mime !in setOf("application/pdf", "image/jpeg", "image/png")) return false
        val bytes = try { Base64.decode(base64, Base64.DEFAULT) } catch (e: IllegalArgumentException) { return false }
        if (bytes.isEmpty() || bytes.size > 25 * 1024 * 1024) return false
        val fileName = name.replace(SAFE_NAME, "").trim().ifEmpty { "grace-file" }.take(80)
        return try {
            val uri = if (Build.VERSION.SDK_INT >= 29) toDownloads(activity, fileName, mime, bytes) else toCache(activity, fileName, bytes)
            activity.runOnUiThread {
                Toast.makeText(activity, if (Build.VERSION.SDK_INT >= 29) "Saved to Downloads" else "Saved", Toast.LENGTH_SHORT).show()
                try {
                    activity.startActivity(
                        Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
                    )
                } catch (e: Exception) {
                    // No viewer for this type: it's still saved.
                }
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun toDownloads(activity: MainActivity, name: String, mime: String, bytes: ByteArray): Uri {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        }
        val resolver = activity.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("no download slot")
        resolver.openOutputStream(uri)!!.use { it.write(bytes) }
        return uri
    }

    private fun toCache(activity: MainActivity, name: String, bytes: ByteArray): Uri {
        val dir = File(activity.cacheDir, "shared").apply { mkdirs() }
        val file = File(dir, name)
        file.writeBytes(bytes)
        return FileProvider.getUriForFile(activity, "${activity.packageName}.files", file)
    }
}
