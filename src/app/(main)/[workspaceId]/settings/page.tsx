import { SettingsLayout } from "@/components/settings/settings-layout";

export default function SettingsPage({ params }: { params: { workspaceId: string } }) {
  return <SettingsLayout workspaceId={params.workspaceId} />;
}
