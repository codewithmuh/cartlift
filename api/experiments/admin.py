from django.contrib import admin
from .models import Experiment, Sample, Variant


class VariantInline(admin.TabularInline):
    model = Variant
    extra = 0
    readonly_fields = ("samples", "conversions", "weight", "created_at")


@admin.register(Experiment)
class ExperimentAdmin(admin.ModelAdmin):
    list_display = ("name", "site", "surface", "status", "uplift_pct", "confidence", "created_at")
    list_filter = ("status", "surface")
    search_fields = ("name", "site__domain", "hypothesis")
    inlines = [VariantInline]
    readonly_fields = ("confidence", "uplift_pct", "started_at", "decided_at", "created_at", "updated_at")


@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = ("variant", "event", "visitor", "created_at")
    list_filter = ("event",)
    search_fields = ("visitor",)
