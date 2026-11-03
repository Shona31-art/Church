package stream.gracebound.grace

import android.app.Application

class GraceApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifier.createChannels(this)
        // Push is started from the settings saved last time, so a call can
        // wake the app even when it hasn't been opened since the phone restarted.
        Push.start(this)
    }
}
