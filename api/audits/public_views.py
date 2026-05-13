"""Public audit endpoints — no JWT required.

Powers the /audit/<slug> shareable preview page on the marketing site.
Visitor pastes a URL on bandit.dev → POST /api/public/audits/ → 201 with
slug → /audit/<slug> is renderable by anyone (good for SEO + sharing).

Findings are not redacted server-side; the marketing page decides which
to blur. Audits remain free to view by anyone who has the slug.
"""
from __future__ import annotations

from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.viewsets import GenericViewSet
from rest_framework.mixins import RetrieveModelMixin

from .models import Audit
from .runner import run_audit
from .serializers import AuditSerializer

# Public audits are always CRO for now — that's the demo-able variant.
# Compliance / GMC are long-form, not shareable hero content.
_PUBLIC_AUDIT_TYPE = "cro"


class PublicAuditViewSet(RetrieveModelMixin, GenericViewSet):
    """Public, unauthenticated audit creation + retrieval by slug.

    Routes:
      POST  /api/public/audits/                 → run a CRO audit (heavy, throttled)
      GET   /api/public/audits/<slug>/          → read an existing public audit
      POST  /api/public/audits/<slug>/claim/    → attach to current user (auth)
    """
    queryset = Audit.objects.filter(is_public=True)
    serializer_class = AuditSerializer
    lookup_field = "slug"
    lookup_value_regex = r"[A-Za-z0-9_\-]{6,24}"
    permission_classes = (AllowAny,)

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "audit-public"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def create(self, request, *args, **kwargs):
        url = (request.data.get("url") or "").strip()
        if not url:
            return Response({"detail": "url is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"

        audit = Audit.objects.create(
            user=None,
            url=url,
            audit_type=_PUBLIC_AUDIT_TYPE,
            status="running",
            is_public=True,
        )
        result = run_audit(url, audit_type=_PUBLIC_AUDIT_TYPE)
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

    @action(
        detail=True, methods=["post"], url_path="claim",
        permission_classes=(IsAuthenticated,),
    )
    def claim(self, request, slug=None):
        """Attach this public audit to the requesting user.

        Idempotent: if the audit already belongs to this user, return 200 with
        the audit; if it belongs to a different user, refuse with 409.
        """
        audit = self.get_object()
        if audit.user_id is None:
            audit.user = request.user
            audit.is_public = False  # claimed audits leave the public pool
            audit.save(update_fields=["user", "is_public"])
        elif audit.user_id != request.user.id:
            return Response(
                {"detail": "already claimed by another account"},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(AuditSerializer(audit).data, status=status.HTTP_200_OK)
