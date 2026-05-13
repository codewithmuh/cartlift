"""Public audit endpoints — no JWT required.

Powers the /audit/<group_slug> shareable preview page on the marketing site.

One public submission = one bundle of FOUR audits (cro, seo, compliance, gmc),
all linked by a shared `group_slug`. The bundle is freely viewable; the
email-gated `download/` action captures a lead before the visitor renders the
print-friendly PDF view.
"""
from __future__ import annotations

import secrets

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.viewsets import GenericViewSet

from .models import Audit, AuditLead
from .runner import run_audits_bundle
from .serializers import AuditSerializer

# Every public submission produces this fixed set, in this display order.
_PUBLIC_AUDIT_TYPES = ["cro", "seo", "compliance", "gmc"]


def _new_group_slug() -> str:
    return secrets.token_urlsafe(8)


def _client_ip(request) -> str | None:
    fwd = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if fwd:
        return fwd.split(",")[0].strip() or None
    return request.META.get("REMOTE_ADDR") or None


def _bundle_payload(audits_qs) -> dict:
    """Shape a queryset of related audits into the bundle response."""
    by_type = {a.audit_type: a for a in audits_qs}
    first = next(iter(by_type.values()))
    return {
        "group_slug": first.group_slug or first.slug,
        "url": first.url,
        "created_at": first.created_at.isoformat(),
        "audits": {
            t: AuditSerializer(by_type[t]).data
            for t in _PUBLIC_AUDIT_TYPES
            if t in by_type
        },
    }


class PublicAuditViewSet(GenericViewSet):
    """Public bundle creation + retrieval by group_slug.

    Routes:
      POST  /api/public/audits/                          → run a 4-type bundle (heavy, throttled)
      GET   /api/public/audits/<group_slug>/             → read the bundle (free, no login)
      POST  /api/public/audits/<group_slug>/download/    → capture email, return bundle (PDF gate)
      POST  /api/public/audits/<group_slug>/claim/       → attach bundle to current user (auth)
    """
    serializer_class = AuditSerializer
    lookup_field = "group_slug"
    lookup_value_regex = r"[A-Za-z0-9_\-]{6,24}"
    permission_classes = (AllowAny,)

    def get_queryset(self):
        return Audit.objects.filter(is_public=True)

    def _bundle_or_404(self, group_slug: str):
        qs = self.get_queryset().filter(group_slug=group_slug).order_by("audit_type")
        if not qs.exists():
            raise NotFound("audit bundle not found")
        return qs

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "audit-public"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def retrieve(self, request, group_slug=None):
        return Response(_bundle_payload(self._bundle_or_404(group_slug)))

    def create(self, request, *args, **kwargs):
        url = (request.data.get("url") or "").strip()
        if not url:
            return Response({"detail": "url is required"}, status=status.HTTP_400_BAD_REQUEST)
        if not url.startswith(("http://", "https://")):
            url = f"https://{url}"

        group_slug = _new_group_slug()

        # Create one Audit row per type up front so the bundle is queryable
        # even if a downstream LLM call fails mid-run.
        rows = {
            t: Audit.objects.create(
                user=None,
                url=url,
                audit_type=t,
                status="running",
                is_public=True,
                group_slug=group_slug,
            )
            for t in _PUBLIC_AUDIT_TYPES
        }

        results = run_audits_bundle(url, _PUBLIC_AUDIT_TYPES)

        now = timezone.now()
        for t, audit in rows.items():
            r = results.get(t, {})
            audit.status = r.get("status", "failed")
            audit.page_title = r.get("page_title", "")
            audit.summary = r.get("summary", "")
            audit.findings = r.get("findings", []) or []
            audit.report = r.get("report", {}) or {}
            audit.elapsed_ms = r.get("elapsed_ms", 0)
            audit.error = r.get("error", "")
            audit.completed_at = now
            audit.save()

        return Response(
            _bundle_payload(rows.values()),
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True, methods=["post"], url_path="download",
        permission_classes=(AllowAny,),
    )
    def download(self, request, group_slug=None):
        """Email gate for PDF download.

        The bundle itself is free to view — this endpoint exists purely to
        capture the visitor's email before they render the print view. Returns
        the bundle on success so the client can immediately trigger window.print()."""
        bundle = self._bundle_or_404(group_slug)
        email = (request.data.get("email") or "").strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {"detail": "valid email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Attach the lead to the cro audit (canonical row in the bundle).
        anchor = bundle.first()
        AuditLead.objects.create(
            audit=anchor,
            email=email,
            ip=_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:255],
        )
        return Response(_bundle_payload(bundle), status=status.HTTP_200_OK)

    @action(
        detail=True, methods=["post"], url_path="claim",
        permission_classes=(IsAuthenticated,),
    )
    def claim(self, request, group_slug=None):
        """Attach every audit in the bundle to the requesting user.

        Idempotent: re-claiming by the same user is a no-op. If any audit in
        the bundle is already owned by a different user, the whole claim is
        refused with 409."""
        bundle = self._bundle_or_404(group_slug)
        other_owner = bundle.filter(user__isnull=False).exclude(user=request.user).exists()
        if other_owner:
            return Response(
                {"detail": "already claimed by another account"},
                status=status.HTTP_409_CONFLICT,
            )
        bundle.filter(user__isnull=True).update(user=request.user, is_public=False)
        return Response(_bundle_payload(self._bundle_or_404(group_slug)))
