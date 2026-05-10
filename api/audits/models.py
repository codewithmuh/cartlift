from django.conf import settings
from django.db import models


class Audit(models.Model):
    """One run of the URL audit pipeline. Each audit produces N findings
    that the dashboard renders as annotation pins on the page screenshot,
    plus an optional long-form `report` body for compliance / GMC types."""

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
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="audits",
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
