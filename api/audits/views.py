from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from experiments.serializers import ExperimentSerializer
from sites.models import Site

from .generator import generate_for_audit
from .models import Audit
from .runner import run_audit
from .serializers import AuditSerializer

VALID_TYPES = {"cro", "seo", "compliance", "gmc"}


class AuditViewSet(viewsets.ModelViewSet):
    """List user's audits, or POST a fresh URL+type to run one synchronously.

    Runner blocks the request for ~3-30s. For prod, push to Celery / Trigger.dev.
    """
    serializer_class = AuditSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    throttle_scope = "audit-run"  # cost-bearing scope; only applied on create + generate_variants

    def get_throttles(self):
        # Only throttle Claude-calling actions. Read-side traffic uses the global defaults.
        if self.action in ("create", "generate_variants"):
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_queryset(self):
        qs = Audit.objects.filter(user=self.request.user)
        audit_type = self.request.query_params.get("type")
        if audit_type and audit_type in VALID_TYPES:
            qs = qs.filter(audit_type=audit_type)
        return qs

    def create(self, request, *args, **kwargs):
        url = (request.data.get("url") or "").strip()
        if not url:
            return Response({"detail": "url is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"
        audit_type = (request.data.get("audit_type") or "cro").strip().lower()
        if audit_type not in VALID_TYPES:
            return Response(
                {"detail": f"audit_type must be one of {sorted(VALID_TYPES)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        audit = Audit.objects.create(
            user=request.user, url=url, audit_type=audit_type, status="running",
        )
        u = request.user
        provider = (u.llm_provider or "anthropic").lower()
        api_key = (u.openai_api_key if provider == "openai" else u.anthropic_api_key) or None
        result = run_audit(
            url,
            audit_type=audit_type,
            provider=provider,
            api_key=api_key,
            model=(u.llm_model or None),
        )
        audit.status = result.get("status", "failed")
        audit.page_title = result.get("page_title", "")
        audit.summary = result.get("summary", "")
        audit.findings = result.get("findings", [])
        audit.report = result.get("report", {})
        audit.elapsed_ms = result.get("elapsed_ms", 0)
        audit.error = result.get("error", "")
        audit.completed_at = timezone.now()
        audit.save()

        return Response(AuditSerializer(audit).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="generate_variants")
    def generate_variants(self, request, pk=None):
        """Turn the audit's findings into draft Experiments + Variants on a chosen Site."""
        audit = self.get_object()
        if audit.status != "done":
            return Response({"detail": "audit must be done"}, status=400)

        site_id = request.data.get("site_id")
        if not site_id:
            return Response({"detail": "site_id required"}, status=400)
        site = Site.objects.filter(id=site_id, user=request.user).first()
        if not site:
            return Response({"detail": "site not found"}, status=404)

        experiments = generate_for_audit(audit, site)
        return Response({
            "created": len(experiments),
            "experiments": ExperimentSerializer(experiments, many=True).data,
        }, status=status.HTTP_201_CREATED)
