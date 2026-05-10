import AuditDetailView from "./AuditDetailView";

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AuditDetailView id={Number(id)} />;
}
