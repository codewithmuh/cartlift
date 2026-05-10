import ExperimentDetailView from "./ExperimentDetailView";

export default async function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExperimentDetailView id={Number(id)} />;
}
