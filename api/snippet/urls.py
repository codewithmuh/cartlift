from django.urls import path
from . import views

urlpatterns = [
    path("s/<str:token>.js", views.serve_snippet),
    path("s/<str:token>/active", views.active_experiments),
    path("s/<str:token>/<str:event_name>", views.event),
]
