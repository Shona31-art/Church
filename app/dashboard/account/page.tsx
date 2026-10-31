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
import { InstallApp } from "@/components/install/InstallApp";
import { EmailChangeForm } from "./EmailChangeForm";

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
          </Section>
        </div>
      )}

      <Section title="My details">
        <ProfileForm name={me.name} email={me.email} phone={profile?.phone ?? null} birthDate={birthday?.birth_date ?? ""} />
      </Section>

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
