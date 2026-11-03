package stream.gracebound.grace

import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.PowerManager
import android.view.WindowManager

/**
 * What the phone does during a call, like WhatsApp: voice calls use the
 * earpiece and the screen goes dark against your ear; video calls use the
 * loudspeaker and keep the screen on. The call keeps going if you switch apps.
 */
class CallMode(private val activity: MainActivity) {
    private var mode = "none"
    private var proximity: PowerManager.WakeLock? = null
    private val audio get() = activity.getSystemService(AudioManager::class.java)

    /** "voice", "video" or "none". */
    fun set(newMode: String) {
        if (newMode == mode) return
        mode = newMode
        if (newMode == "none") {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            releaseProximity()
            speaker(false)
            audio.mode = AudioManager.MODE_NORMAL
            CallService.stop(activity)
            activity.showOverLockScreen(false)
            return
        }
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        audio.mode = AudioManager.MODE_IN_COMMUNICATION
        speaker(newMode == "video")
        CallService.start(activity)
    }

    fun speaker(on: Boolean) {
        val am = audio
        if (Build.VERSION.SDK_INT >= 31) {
            if (on) {
                am.availableCommunicationDevices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }?.let { am.setCommunicationDevice(it) }
            } else {
                am.clearCommunicationDevice()
            }
        } else {
            @Suppress("DEPRECATION")
            am.isSpeakerphoneOn = on
        }
        // Earpiece: darken the screen when the phone is at your ear.
        if (mode == "voice" && !on) holdProximity() else releaseProximity()
    }

    private fun holdProximity() {
        if (proximity?.isHeld == true) return
        val pm = activity.getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return
        proximity = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "grace:call").apply { acquire(3 * 60 * 60 * 1000L) }
    }

    private fun releaseProximity() {
        proximity?.let { if (it.isHeld) it.release() }
        proximity = null
    }
}
