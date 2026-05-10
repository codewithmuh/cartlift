from rest_framework import viewsets

from .models import Site
from .serializers import SiteSerializer


class SiteViewSet(viewsets.ModelViewSet):
    serializer_class = SiteSerializer

    def get_queryset(self):
        return Site.objects.filter(user=self.request.user)
