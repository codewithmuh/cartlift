"""Public, unauthenticated audit routes — mounted at /api/public/audits/."""
from rest_framework.routers import DefaultRouter

from .public_views import PublicAuditViewSet

router = DefaultRouter()
router.register("", PublicAuditViewSet, basename="public-audit")
urlpatterns = router.urls
