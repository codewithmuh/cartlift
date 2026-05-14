from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Experiment, Variant
from .serializers import ExperimentSerializer, VariantSerializer, WeightSnapshotSerializer


class ExperimentViewSet(viewsets.ModelViewSet):
    serializer_class = ExperimentSerializer

    def get_queryset(self):
        return (
            Experiment.objects
            .filter(site__user=self.request.user)
            .select_related("site")
            .prefetch_related("variants")
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Flip a draft experiment to trial (snippet picks it up next page load)."""
        exp = self.get_object()
        if exp.status not in {"draft", "paused"}:
            return Response({"detail": f"can't approve from {exp.status}"}, status=400)
        exp.status = "trial"
        exp.started_at = timezone.now()
        exp.save(update_fields=["status", "started_at"])
        return Response(ExperimentSerializer(exp).data)

    @action(detail=True, methods=["post"])
    def kill(self, request, pk=None):
        """Stop a running experiment immediately. Snippet stops serving variants."""
        exp = self.get_object()
        exp.status = "killed"
        exp.decided_at = timezone.now()
        exp.save(update_fields=["status", "decided_at"])
        return Response(ExperimentSerializer(exp).data)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        """Pause without killing — snippet stops, but it can be resumed later."""
        exp = self.get_object()
        exp.status = "paused"
        exp.save(update_fields=["status"])
        return Response(ExperimentSerializer(exp).data)

    @action(detail=True, methods=["get"], url_path="weight_history")
    def weight_history(self, request, pk=None):
        """Frozen per-tick snapshots produced by the allocator. Powers the
        dashboard chart that shows how Thompson sampling moved traffic over time.
        """
        exp = self.get_object()
        try:
            limit = min(int(request.query_params.get("limit", "200")), 1000)
        except (TypeError, ValueError):
            limit = 200
        # Newest-last so the chart x-axis flows left→right chronologically
        snaps = list(exp.weight_snapshots.order_by("-created_at")[:limit])
        snaps.reverse()
        return Response({
            "experiment_id": exp.id,
            "snapshots": WeightSnapshotSerializer(snaps, many=True).data,
        })


class VariantViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only — variants are mutated by the allocator + by approve/kill on Experiment."""
    serializer_class = VariantSerializer

    def get_queryset(self):
        return Variant.objects.filter(experiment__site__user=self.request.user)
