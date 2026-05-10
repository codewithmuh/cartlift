from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Experiment, Variant
from .serializers import ExperimentSerializer, VariantSerializer


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


class VariantViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only — variants are mutated by the allocator + by approve/kill on Experiment."""
    serializer_class = VariantSerializer

    def get_queryset(self):
        return Variant.objects.filter(experiment__site__user=self.request.user)
