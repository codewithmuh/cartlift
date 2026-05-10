from rest_framework import serializers
from .models import Site


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ("id", "domain", "label", "token", "sampling", "created_at", "updated_at")
        read_only_fields = ("id", "token", "created_at", "updated_at")

    def create(self, validated_data):
        return Site.objects.create(user=self.context["request"].user, **validated_data)
