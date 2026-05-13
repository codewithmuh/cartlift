from django.contrib import admin
from .models import Audit, AuditLead


@admin.register(Audit)
class AuditAdmin(admin.ModelAdmin):
    list_display = ("url", "user", "status", "elapsed_ms", "created_at")
    list_filter = ("status",)
    search_fields = ("url", "user__email")
    readonly_fields = ("findings", "summary", "page_title", "elapsed_ms",
                       "error", "created_at", "completed_at")


@admin.register(AuditLead)
class AuditLeadAdmin(admin.ModelAdmin):
    list_display = ("email", "audit", "ip", "created_at")
    search_fields = ("email", "audit__url")
    readonly_fields = ("audit", "email", "ip", "user_agent", "created_at")
