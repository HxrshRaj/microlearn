from django.urls import path

from . import views

urlpatterns = [
    path("auth/signup", views.SignupView.as_view()),
    path("auth/login", views.LoginView.as_view()),
    path("me", views.MeView.as_view()),
    path("history", views.HistoryView.as_view()),
    path("lessons", views.LessonListView.as_view()),
    path("lessons/<int:pk>", views.LessonDetailView.as_view()),
    path("lessons/<int:pk>/submit", views.SubmitView.as_view()),
    path("leaderboard", views.LeaderboardView.as_view()),
]
