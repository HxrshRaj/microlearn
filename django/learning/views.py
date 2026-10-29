from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Exists, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.authtoken.models import Token
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import services
from .models import Attempt, Lesson, Profile
from .serializers import (AttemptSerializer, LessonDetailSerializer, LessonListSerializer, ProfileSerializer,
                          SignupSerializer, SubmitSerializer)

User = get_user_model()


class SignupView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"

    def post(self, request):
        s = SignupSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        with transaction.atomic():
            user = User.objects.create_user(s.validated_data["username"], password=s.validated_data["password"])
            Profile.objects.create(user=user)
            token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "username": user.username}, status=status.HTTP_201_CREATED)


class LoginView(ObtainAuthToken):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        s = self.serializer_class(data=request.data, context={"request": request})
        s.is_valid(raise_exception=True)
        token, _ = Token.objects.get_or_create(user=s.validated_data["user"])
        return Response({"token": token.key, "username": s.validated_data["user"].username})


def lessons_for(user):
    """One query for the whole catalogue: per-user flags come from correlated subqueries, not a query per row."""
    mine = Attempt.objects.filter(user=user, lesson=OuterRef("pk"))
    return (Lesson.objects.select_related("category")
            .annotate(question_count=Count("questions", distinct=True),
                      completed=Exists(mine),
                      best_score=Subquery(mine.order_by("-score").values("score")[:1], output_field=IntegerField()))
            .order_by("sort_order", "id"))


class LessonListView(generics.ListAPIView):
    serializer_class = LessonListSerializer

    def get_queryset(self):
        qs = lessons_for(self.request.user)
        cat = self.request.query_params.get("category")
        return qs.filter(category__name=cat) if cat else qs


class LessonDetailView(generics.RetrieveAPIView):
    serializer_class = LessonDetailSerializer

    def get_queryset(self):
        return lessons_for(self.request.user).prefetch_related("questions")  # 2 queries total, not 1 + N


class SubmitView(APIView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "submit"

    def post(self, request, pk):
        lesson = get_object_or_404(Lesson.objects.prefetch_related("questions"), pk=pk)
        s = SubmitSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        try:
            result = services.submit_attempt(request.user, lesson, s.validated_data["answers"])
        except services.SubmissionError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        # Reveal the answer key only after the attempt is recorded.
        result["answers"] = [{"question_id": q.id, "correct_index": q.correct_index} for q in lesson.questions.all()]
        return Response(result, status=status.HTTP_201_CREATED)


class MeView(APIView):
    def get(self, request):
        profile, _ = Profile.objects.select_related("user").get_or_create(user=request.user)
        profile.lessons_completed = Attempt.objects.filter(user=request.user).values("lesson").distinct().count()
        return Response(ProfileSerializer(profile).data)


class HistoryView(generics.ListAPIView):
    serializer_class = AttemptSerializer

    def get_queryset(self):
        return Attempt.objects.filter(user=self.request.user).select_related("lesson")


class LeaderboardView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []

    def get(self, request):
        return Response(services.leaderboard(limit=min(int(request.query_params.get("limit", 10) or 10), 50)))
