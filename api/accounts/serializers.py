from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


def _preview(key: str) -> str:
    key = key or ""
    if not key:
        return ""
    if len(key) <= 11:
        return "…" + key[-4:]
    return f"{key[:7]}…{key[-4:]}"


class UserSerializer(serializers.ModelSerializer):
    # Write-only — accepted on PATCH, never returned to the client.
    anthropic_api_key = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=255,
    )
    openai_api_key = serializers.CharField(
        write_only=True, required=False, allow_blank=True, max_length=255,
    )
    # Read-only convenience fields so the UI can show "set / not set" and a
    # redacted preview without ever exposing the actual secret.
    has_anthropic_key = serializers.SerializerMethodField()
    anthropic_key_preview = serializers.SerializerMethodField()
    has_openai_key = serializers.SerializerMethodField()
    openai_key_preview = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id", "email", "company", "created_at", "last_login",
            "llm_provider", "llm_model",
            "anthropic_api_key", "has_anthropic_key", "anthropic_key_preview",
            "openai_api_key", "has_openai_key", "openai_key_preview",
        )
        read_only_fields = ("id", "created_at", "last_login")

    def get_has_anthropic_key(self, obj) -> bool:
        return bool(obj.anthropic_api_key)

    def get_anthropic_key_preview(self, obj) -> str:
        return _preview(obj.anthropic_api_key)

    def get_has_openai_key(self, obj) -> bool:
        return bool(obj.openai_api_key)

    def get_openai_key_preview(self, obj) -> str:
        return _preview(obj.openai_api_key)

    def validate_anthropic_api_key(self, value: str) -> str:
        value = (value or "").strip()
        if value and not value.startswith("sk-ant-"):
            raise serializers.ValidationError(
                "Anthropic keys start with 'sk-ant-'. Paste the full key from console.anthropic.com.",
            )
        return value

    def validate_openai_api_key(self, value: str) -> str:
        value = (value or "").strip()
        if value and not value.startswith("sk-"):
            raise serializers.ValidationError(
                "OpenAI keys start with 'sk-'. Paste the full key from platform.openai.com.",
            )
        return value


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("email", "password", "company")

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        user = authenticate(
            request=self.context.get("request"),
            email=attrs["email"].lower(),
            password=attrs["password"],
        )
        if not user:
            raise serializers.ValidationError(
                {"detail": "Invalid email or password."}, code="auth",
            )
        attrs["user"] = user
        return attrs


def issue_tokens(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
        "user": UserSerializer(user).data,
    }
