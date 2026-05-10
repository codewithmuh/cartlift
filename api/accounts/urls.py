from django.urls import path
from .views import LoginView, MeView, SignupView

urlpatterns = [
    path("signup", SignupView.as_view()),
    path("login", LoginView.as_view()),
    path("me", MeView.as_view()),
]
