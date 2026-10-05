import { redirect } from "next/navigation";

export default async function PatientIdTabPage({
  params,
}: {
  params: Promise<{ id: string; tab: string }>;
}) {
  const { tab } = await params;
  redirect(`/patient/${tab}`);
}
