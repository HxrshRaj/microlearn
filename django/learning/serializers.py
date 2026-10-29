from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Attempt, Lesson, Profile, Question

User = get_user_model()


class SignupSerializer(serializers.Serializer):
    username = serializers.RegexField(r"^[A-Za-z0-9_]{3,30}$", error_messages={
        "invalid": "3-30 characters: letters, numbers and underscores only"})
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("username already taken")
        return value

    def validate(self, attrs):
        try:
            password_validation.validate_password(attrs["password"], User(username=attrs["username"]))
        except DjangoValidationError as e:
            raise serializers.ValidationError({"password": list(e.messages)})
        return attrs


class QuestionSerializer(serializers.ModelSerializer):
    """Never exposes correct_index: grading happens on the server."""
    class Meta:
        model = Question
        fields = ["id", "prompt", "options"]


class LessonListSerializer(serializers.ModelSerializer):
    category = serializers.CharField(source="category.name")
    question_count = serializers.IntegerField(read_only=True)
    completed = serializers.BooleanField(read_only=True)
    best_score = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Lesson
        fields = ["id", "title", "category", "summary", "xp_reward", "question_count", "completed", "best_score"]


class LessonDetailSerializer(LessonListSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta(LessonListSerializer.Meta):
        fields = LessonListSerializer.Meta.fields + ["questions"]


class SubmitSerializer(serializers.Serializer):
    answers = serializers.ListField(child=serializers.IntegerField(), allow_empty=False, max_length=50)


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username")
    joined = serializers.DateTimeField(source="user.date_joined")
    lessons_completed = serializers.IntegerField(read_only=True)

    class Meta:
        model = Profile
        fields = ["username", "joined", "total_xp", "current_streak", "longest_streak", "lessons_completed"]


class AttemptSerializer(serializers.ModelSerializer):
    lesson = serializers.CharField(source="lesson.title")

    class Meta:
        model = Attempt
        fields = ["id", "lesson", "score", "total", "xp_awarded", "created_at"]
