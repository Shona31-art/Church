import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/current-user";
import { roleLabel } from "@/lib/permissions";
import { PageHeader, Section, DetailList } from "@/components/ui/PageHeader";
import { PasswordForm, ProfileForm } from "./AccountForms";
import { ProfilePhotoForm } from "./ProfilePhotoForm";
import { getAvatarUrls } from "@/lib/avatars";
import { Alert } from "@/components/ui/Alert";

export default async function MyAccountPage() {
  const me = (await getCurrentAppUser())!;
  const supabase = createClient();
  const [{ data: profile }, { data: birthday }, { data: church }, { data: department }, chatProfile, avatars] = await Promise.all([
    supabase.from("app_users").select("phone").eq("id", me.id).maybeSingle(),
    supabase.from("member_birthdays").select("birth_date").eq("user_id", me.id).maybeSingle(),
    me.church_id ? supabase.from("churches").select("name, email, phone").eq("id", me.church_id).maybeSingle() : Promise.resolve({ data: null }),
    me.department_id ? supabase.from("departments").select("name").eq("id", me.department_id).maybeSingle() : Promise.resolve({ data: null }),
    // Separate query: these columns arrive with chat_v2.sql, and the rest of
    // the page must keep working if that migration hasn't been run yet.
    supabase.from("app_users").select("about").eq("id", me.id).maybeSingle(),
    getAvatarUrls([me.id]),
  ]);
  const photosReady = !chatProfile.error;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="My account" description="Your details, password and personal data." />

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

      <Section title="Password">
        <PasswordForm />
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
