from django.urls import path
from . import views

urlpatterns = [
    path("csrf/", views.CSRFView.as_view()),
    path("signup/", views.SignupView.as_view()),
    path("login/", views.LoginView.as_view()),
    path("logout/", views.LogoutView.as_view()),
    path("me/", views.UserDetailView.as_view()),
    path("lock/", views.LockView.as_view()),
    path("confirm-password/", views.ConfirmPasswordView.as_view()),
    path("passwords/", views.PasswordListView.as_view()),
    path("passwords/<int:pk>/", views.PasswordDetailView.as_view()),
    path("image/", views.FaceStatusView.as_view()),
    path("image-upload/", views.FaceEnrollView.as_view()),
    path("verify-face/", views.FaceVerifyView.as_view()),
]
