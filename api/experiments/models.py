from django.db import models

from sites.models import Site


class Experiment(models.Model):
    """A single CRO trial running on a site. Holds N variants; one is the
    control (original page). Multi-armed bandit allocates traffic over time.
    """

    STATUS = [
        ("draft", "Draft"),
        ("trial", "Trial"),
        ("winner", "Winner"),
        ("killed", "Killed"),
        ("paused", "Paused"),
    ]
    SURFACES = [
        ("hero_headline", "Hero · Headline"),
        ("hero_cta", "Hero · CTA"),
        ("pricing_cta", "Pricing · CTA"),
        ("checkout_cta", "Checkout · CTA"),
        ("nav", "Nav"),
        ("footer", "Footer"),
        ("custom", "Custom selector"),
    ]

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="experiments")
    name = models.CharField(max_length=200)
    surface = models.CharField(max_length=32, choices=SURFACES, default="hero_headline")
    selector = models.CharField(
        max_length=255, blank=True,
        help_text="CSS selector when surface is 'custom'.",
    )
    hypothesis = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=STATUS, default="draft")
    confidence = models.FloatField(default=0.0)
    uplift_pct = models.FloatField(default=0.0)
    started_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_status_display()})"


class Variant(models.Model):
    """One arm of an experiment — the control or a generated variant."""

    experiment = models.ForeignKey(Experiment, on_delete=models.CASCADE, related_name="variants")
    name = models.CharField(max_length=120)
    is_control = models.BooleanField(default=False)
    body = models.TextField(blank=True, help_text="Variant content (HTML, text, JSON depending on surface).")
    rationale = models.TextField(blank=True, help_text="Why bandit thinks this might win.")
    samples = models.PositiveIntegerField(default=0)
    conversions = models.PositiveIntegerField(default=0)
    weight = models.FloatField(default=0.5, help_text="Bandit-assigned traffic weight (0..1).")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["experiment_id", "-is_control", "-weight"]

    @property
    def conversion_rate(self) -> float:
        return self.conversions / self.samples if self.samples else 0.0

    def __str__(self) -> str:
        return f"{self.experiment_id}/{self.name}"


class Sample(models.Model):
    """A single visitor exposure or conversion event. Append-only."""

    EVENT = [("expose", "Expose"), ("convert", "Convert")]

    variant = models.ForeignKey(Variant, on_delete=models.CASCADE, related_name="samples_set")
    event = models.CharField(max_length=12, choices=EVENT)
    visitor = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["variant", "event", "created_at"])]
