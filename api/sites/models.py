import secrets
from django.conf import settings
from django.db import models


def _site_token() -> str:
    return f"bnd_{secrets.token_urlsafe(20)}"


class Site(models.Model):
    """A site bandit is watching. The token is what the JS snippet uses
    to identify itself when it phones home with sample events."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sites",
    )
    domain = models.CharField(max_length=255)
    label = models.CharField(max_length=120, blank=True)
    token = models.CharField(max_length=64, unique=True, default=_site_token, editable=False)
    sampling = models.PositiveSmallIntegerField(
        default=50, help_text="Percentage of visitors who see variants (0-100).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "domain"], name="uniq_user_domain"),
        ]

    def __str__(self) -> str:
        return f"{self.domain} ({self.user_id})"
