from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str, **extra):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self._create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    LLM_PROVIDER_CHOICES = (
        ("anthropic", "Anthropic (Claude)"),
        ("openai", "OpenAI (ChatGPT)"),
    )

    email = models.EmailField(unique=True)
    company = models.CharField(max_length=120, blank=True)
    # Per-user LLM configuration. Keys are stored as supplied; never returned
    # via the API (only masked previews). When the chosen provider's key is
    # blank, the audit runner falls back to the server-wide env-var keys, so
    # the demo flow keeps working out of the box.
    llm_provider = models.CharField(
        max_length=16, choices=LLM_PROVIDER_CHOICES, default="anthropic",
    )
    llm_model = models.CharField(max_length=64, blank=True, default="")
    anthropic_api_key = models.CharField(max_length=255, blank=True, default="")
    openai_api_key = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(blank=True, null=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.email
