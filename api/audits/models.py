import secrets

from django.conf import settings
from django.db import models


def _gen_slug() -> str:
    """Short URL-safe slug for public audit pages (~11 chars)."""
    return secrets.token_urlsafe(8)


class Audit(models.Model):
    """One run of the URL audit pipeline. Each audit produces N findings
    that the dashboard renders as annotation pins on the page screenshot,
    plus an optional long-form `report` body for compliance / GMC types.

    `user` is nullable to allow guest (landing-page) audits — those are
    created via the public endpoint and can be claimed by a user after signup."""

    STATUS = [
        ("queued", "Queued"),
        ("running", "Running"),
        ("done", "Done"),
        ("failed", "Failed"),
    ]

    AUDIT_TYPES = [
        ("cro", "Conversion rate"),
        ("seo", "SEO"),
        ("compliance", "Site compliance"),
        ("gmc", "Google Merchant Center"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="audits",
        null=True,
        blank=True,
    )
    slug = models.CharField(
        max_length=24, unique=True, default=_gen_slug, db_index=True,
        help_text="Short URL-safe id used for public /audit/<slug> share pages.",
    )
    group_slug = models.CharField(
        max_length=24, blank=True, default="", db_index=True,
        help_text=(
            "Shared id for an audit bundle. All four audit types created "
            "from one public submission share this slug — the public page "
            "fetches by group_slug and renders four tabs."
        ),
    )
    is_public = models.BooleanField(
        default=False,
        help_text="Created via the landing-page URL input; safe to render on /audit/<slug>.",
    )
    url = models.URLField()
    audit_type = models.CharField(max_length=16, choices=AUDIT_TYPES, default="cro")
    status = models.CharField(max_length=16, choices=STATUS, default="queued")
    page_title = models.CharField(max_length=255, blank=True)
    summary = models.TextField(blank=True)
    findings = models.JSONField(default=list)
    report = models.JSONField(default=dict, blank=True,
                              help_text="Long-form structured report (used by compliance/gmc types).")
    elapsed_ms = models.PositiveIntegerField(default=0)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.url} · {self.audit_type} ({self.status})"


class AuditLead(models.Model):
    """Email captured to unlock the rest of a public audit's findings.

    Low-friction conversion step: visitors paste a URL, see 2 findings, and
    drop their email to reveal the rest. Stored for follow-up; the user can
    still create a full account later via the existing claim flow."""

    audit = models.ForeignKey(Audit, on_delete=models.CASCADE, related_name="leads")
    email = models.EmailField()
    ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["email", "audit"])]

    def __str__(self) -> str:
        return f"{self.email} → {self.audit.slug}"
