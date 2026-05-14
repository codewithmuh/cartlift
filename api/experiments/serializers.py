from rest_framework import serializers
from .models import Experiment, Variant, WeightSnapshot


class VariantSerializer(serializers.ModelSerializer):
    conversion_rate = serializers.FloatField(read_only=True)

    class Meta:
        model = Variant
        fields = ("id", "name", "is_control", "body", "rationale",
                  "samples", "conversions", "weight", "conversion_rate", "created_at")
        read_only_fields = ("id", "samples", "conversions", "weight",
                            "conversion_rate", "created_at")


class ExperimentSerializer(serializers.ModelSerializer):
    variants = VariantSerializer(many=True, read_only=True)
    site_domain = serializers.CharField(source="site.domain", read_only=True)

    class Meta:
        model = Experiment
        fields = (
            "id", "site", "site_domain", "name", "surface", "selector",
            "hypothesis", "status", "confidence", "uplift_pct",
            "started_at", "decided_at", "created_at", "updated_at", "variants",
        )
        read_only_fields = (
            "id", "site_domain", "confidence", "uplift_pct",
            "started_at", "decided_at", "created_at", "updated_at", "variants",
        )

    def validate_site(self, value):
        request = self.context["request"]
        if value.user_id != request.user.id:
            raise serializers.ValidationError("Site does not belong to this account.")
        return value


class WeightSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeightSnapshot
        fields = ("id", "confidence", "uplift_pct", "leader_variant_id",
                  "shipped", "arms", "created_at")
        read_only_fields = fields
