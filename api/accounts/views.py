from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginSerializer, SignupSerializer, UserSerializer, issue_tokens


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = SignupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = s.save()
        return Response(issue_tokens(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        s = LoginSerializer(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        user = s.validated_data["user"]
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        return Response(issue_tokens(user))


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
