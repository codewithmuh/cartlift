from django.contrib import admin
from .models import Site


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ("domain", "user", "sampling", "token", "created_at")
    search_fields = ("domain", "user__email", "token")
    readonly_fields = ("token", "created_at", "updated_at")
