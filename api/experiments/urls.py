from rest_framework.routers import DefaultRouter
from .views import ExperimentViewSet, VariantViewSet

router = DefaultRouter()
router.register("variants", VariantViewSet, basename="variant")
router.register("", ExperimentViewSet, basename="experiment")
urlpatterns = router.urls
