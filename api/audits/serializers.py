from rest_framework import serializers
from .models import Audit


class AuditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Audit
        fields = (
            "id", "url", "audit_type", "status", "page_title", "summary",
            "findings", "report", "elapsed_ms", "error",
            "created_at", "completed_at",
        )
        read_only_fields = (
            "id", "status", "page_title", "summary", "findings", "report",
            "elapsed_ms", "error", "created_at", "completed_at",
        )
