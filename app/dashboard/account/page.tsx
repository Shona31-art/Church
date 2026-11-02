import { createClient } from "@/lib/supabase/server";
import { DisplaySettings } from "@/components/ui/DisplaySettings";
import { getCurrentAppUser } from "@/lib/current-user";
import { roleLabel } from "@/lib/permissions";
import { PageHeader, Section, DetailList } from "@/components/ui/PageHeader";
import { PasswordForm, ProfileForm } from "./AccountForms";
import { ProfilePhotoForm } from "./ProfilePhotoForm";
import { ChatPrivacyForm } from "./ChatPrivacyForm";
import { getAvatarUrls } from "@/lib/avatars";
import { Alert } from "@/components/ui/Alert";
import { PushSettings } from "@/components/notifications/PushSettings";
import { AlertChannels } from "@/components/notifications/AlertChannels";
import { makeConfigured } from "@/lib/alert-delivery";
import { InstallApp } from "@/components/install/InstallApp";
import { EmailChangeForm } from "./EmailChangeForm";
import { PreviewSetting } from "@/components/notifications/PreviewSetting";
import { LastSeenSetting } from "@/components/chat/LastSeenSetting";
import { ChildrenList } from "@/components/members/ChildrenList";
import { loadChildren } from "@/lib/children";

export default async function MyAccountPage({ searchParams }: { searchParams: { email?: string } }) {
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  // Supabase keeps a requested-but-unconfirmed email as `new_email` on the auth user.
  const { data: authData } = await supabase.auth.getUser();
  const pendingEmail = authData.user?.new_email ?? null;
  const [{ data: profile }, { data: birthday }, { data: church }, { data: department }, chatProfile, avatars] = await Promise.all([
    supabase.from("app_users").select("phone").eq("id", me.id).maybeSingle(),
    supabase.from("member_birthdays").select("birth_date").eq("user_id", me.id).maybeSingle(),
    me.church_id ? supabase.from("churches").select("name, email, phone").eq("id", me.church_id).maybeSingle() : Promise.resolve({ data: null }),
    me.department_id ? supabase.from("departments").select("name").eq("id", me.department_id).maybeSingle() : Promise.resolve({ data: null }),
    // Separate query: these columns arrive with chat_v2.sql, and the rest of
    // the page must keep working if that migration hasn't been run yet.
    supabase.from("app_users").select("about, dm_privacy, share_read_receipts").eq("id", me.id).maybeSingle(),
    getAvatarUrls([me.id]),
  ]);
  const children = me.church_id ? await loadChildren(me.id) : null;
  const photosReady = !chatProfile.error;

  // People I've blocked (RLS: only my own blocks are visible).
  const { data: blockRows } = photosReady ? await supabase.from("chat_blocks").select("blocked_id, app_users!chat_blocks_blocked_id_fkey(name)").eq("blocker_id", me.id) : { data: [] };
  const blockedIds = (blockRows ?? []).map((b: any) => b.blocked_id as string);
  const blockedPhotos = await getAvatarUrls(blockedIds);
  // Pop-up preferences: no row means the defaults (all on). If migration #28
  // hasn't run, the section is hidden rather than breaking the page.
  const prefsRes = await supabase.from("notification_preferences").select("push_church_news, push_messages, push_prayer_care, push_alerts").eq("user_id", me.id).maybeSingle();
  const pushPrefs = {
    church_news: prefsRes.data?.push_church_news ?? true,
    messages: prefsRes.data?.push_messages ?? true,
    prayer_care: prefsRes.data?.push_prayer_care ?? true,
    alerts: prefsRes.data?.push_alerts ?? true,
  };

  // Last seen (chat_v4.sql); no row yet = shared (the default).
  const presenceRes = await supabase.from("user_presence").select("show_last_seen").eq("user_id", me.id).maybeSingle();
  // Message previews (chat_notifications_v2.sql); hidden until that's run.
  const previewRes = await supabase.from("notification_preferences").select("show_previews").eq("user_id", me.id).maybeSingle();

  // WhatsApp alerts are for the people who get pastor & admin alerts, and only
  // show once the platform has them switched on (MAKE_WEBHOOK_URL).
  const getsAlerts = (me.role === "pastor" || me.role === "church_admin") && makeConfigured();
  const channelRes = getsAlerts ? await supabase.from("notification_preferences").select("whatsapp_alerts").eq("user_id", me.id).maybeSingle() : null;

  const blocked = (blockRows ?? []).map((b: any) => ({ id: b.blocked_id, name: b.app_users?.name ?? "Former member", photoUrl: blockedPhotos.get(b.blocked_id) ?? null }));

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="My account" description="Your details, password and personal data." back={{ href: "/dashboard", label: "Home" }} />

      {me.church_id && (
        <Section title="Profile photo" description="How people in your church recognise you in chats and lists.">
          {photosReady ? (
            <ProfilePhotoForm
              churchId={me.church_id}
              userId={me.id}
              name={me.name}
              photoUrl={avatars.get(me.id) ?? null}
              about={chatProfile.data?.about ?? null}
            />
          ) : (
            <Alert tone="info">Profile photos will be available once your church&apos;s database update is installed.</Alert>
          )}
        </Section>
      )}

      {me.church_id && photosReady && (
        <Section title="Chat privacy" description="Control who can message you privately and whether they see when you've read their messages.">
          <ChatPrivacyForm
            dmPrivacy={(chatProfile.data?.dm_privacy as "everyone" | "leaders" | "nobody") ?? "everyone"}
            shareReadReceipts={chatProfile.data?.share_read_receipts ?? true}
            blocked={blocked}
          />
          {!presenceRes.error && <LastSeenSetting initial={presenceRes.data?.show_last_seen ?? true} />}
        </Section>
      )}

      <div id="display" className="scroll-mt-24">
        <Section title="Display" description="Text size, contrast and light or dark — for this device.">
          <DisplaySettings />
        </Section>
      </div>

      <div id="install" className="scroll-mt-24">
        <Section title="Install the app" description="Open Grace from your phone's home screen, full screen, like any other app.">
          <InstallApp />
        </Section>
      </div>

      {!prefsRes.error && (
        <div id="notifications" className="scroll-mt-24">
          <Section title="Notifications" description="Get a pop-up on your phone or computer when something happens, even when the app is closed.">
            <PushSettings initialPreferences={pushPrefs} />
            {!previewRes.error && <PreviewSetting initial={previewRes.data?.show_previews ?? true} />}
            {channelRes && !channelRes.error && (
              <AlertChannels
                initial={channelRes.data?.whatsapp_alerts ?? true}
                phone={profile?.phone ?? null}
                available
              />
            )}
          </Section>
        </div>
      )}

      <Section title="My details">
        <ProfileForm name={me.name} email={me.email} phone={profile?.phone ?? null} birthDate={birthday?.birth_date ?? ""} />
      </Section>

      {children && (
        <div id="children" className="scroll-mt-24">
          <Section title="My children" description="Add your children's names and birthdays so your pastors can pray for them and celebrate with your family.">
            <ChildrenList parentId={me.id} items={children} self />
          </Section>
        </div>
      )}

      {church && (
        <Section title="My church">
          <DetailList
            items={[
              { label: "Church", value: church.name },
              { label: "Role", value: roleLabel(me.role) },
              { label: "Department", value: department?.name },
              { label: "Church contact", value: [church.email, church.phone].filter(Boolean).join(" · ") || null },
            ]}
          />
        </Section>
      )}

      <div id="email" className="scroll-mt-24">
        <Section title="Email address" description="The address you sign in with and receive church emails at.">
          {searchParams?.email === "confirmed" && (
            <Alert tone="success" className="mb-4">
              Thanks — that confirmation was received. If we also emailed your other address, open that link too; your sign-in changes once both are done.
            </Alert>
          )}
          {searchParams?.email === "link_problem" && (
            <Alert tone="error" className="mb-4">
              That link didn&apos;t work — it may have expired or already been used. Ask for the change again below.
            </Alert>
          )}
          <EmailChangeForm currentEmail={me.email} pendingEmail={pendingEmail} />
        </Section>
      </div>

      <Section title="Password">
        <div id="password" className="scroll-mt-24">
          <PasswordForm />
        </div>
      </Section>

      {me.church_id && (
        <Section
          title="My data"
          description="Under POPIA you can see what we hold about you and ask for it to be deleted."
        >
          <div className="flex flex-wrap gap-2">
            {/* Plain link: a file download from an API route. */}
            <a href={`/api/members/${me.id}/export`} className="btn-secondary">
              Download my data
            </a>
          </div>
          <p className="text-xs text-ink/60 mt-3">
            To have your account and personal data deleted, ask your church admin{church?.email ? ` (${church.email})` : ""}. Your private journal
            is encrypted and is deleted with your account.
          </p>
        </Section>
      )}
    </div>
  );
}
