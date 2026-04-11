import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { canAccessSettings, type PermissionSession } from "@/lib/permissions";
import { PageContainer, Card, Section } from "@/components/ui";
import { SettingsMinistries } from "@/features/settings/SettingsMinistries";
import { SettingsInstruments } from "@/features/settings/SettingsInstruments";
import { SettingsSingerRoles } from "@/features/settings/SettingsSingerRoles";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  const ps: PermissionSession = {
    isAdmin: session?.isAdmin ?? false,
    ministryIds: session?.ministryIds ?? [],
    headOfMinistryIds: session?.headOfMinistryIds ?? [],
  };
  // All settings (ministries, instruments, singer roles) are admin-only under
  // the new model.
  if (!canAccessSettings(ps)) {
    redirect("/dashboard");
  }

  return (
    <PageContainer
      title="System Settings"
      description="Manage ministries, instruments, and singer roles"
    >
      <Section title="Ministries">
        <Card>
          <SettingsMinistries />
        </Card>
      </Section>
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
