from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("-created_at",)
    list_display = ("email", "company", "is_active", "is_staff", "created_at")
    search_fields = ("email", "company")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Company", {"fields": ("company",)}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Timestamps", {"fields": ("last_login", "created_at")}),
    )
    readonly_fields = ("created_at", "last_login")
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "company")}),
    )
