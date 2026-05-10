from django.contrib import admin
from .models import Audit


@admin.register(Audit)
class AuditAdmin(admin.ModelAdmin):
    list_display = ("url", "user", "status", "elapsed_ms", "created_at")
    list_filter = ("status",)
    search_fields = ("url", "user__email")
    readonly_fields = ("findings", "summary", "page_title", "elapsed_ms",
                       "error", "created_at", "completed_at")
