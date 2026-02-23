import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canManageInstrumentsAndSingers } from "@/lib/permissions";
import type { RoleSlug } from "@/lib/permissions";
import { PageContainer, Card, Section } from "@/components/ui";
import { SettingsMinistries } from "@/features/settings/SettingsMinistries";
import { SettingsInstruments } from "@/features/settings/SettingsInstruments";
import { SettingsSingerRoles } from "@/features/settings/SettingsSingerRoles";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const roleSlug = (session as { roleSlug?: RoleSlug })?.roleSlug ?? "user";
  const isAdmin = roleSlug === "admin";
  const canManageMusic = canManageInstrumentsAndSingers(roleSlug);

  if (!isAdmin && !canManageMusic) {
    redirect("/dashboard");
  }

  return (
    <PageContainer
      title={isAdmin ? "System Settings" : "Music Setup"}
      description={
        isAdmin
          ? "Manage ministries, instruments, and singer roles"
          : "Manage instruments and singer roles for lineups"
      }
    >
      {isAdmin && (
        <Section title="Ministries">
          <Card>
            <SettingsMinistries />
          </Card>
        </Section>
      )}
      <Section title="Instruments">
        <Card>
          <SettingsInstruments />
        </Card>
      </Section>
      <Section title="Singer roles">
        <Card>
          <SettingsSingerRoles />
        </Card>
      </Section>
    </PageContainer>
  );
}
