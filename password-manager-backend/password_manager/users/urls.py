from django.urls import path

# from .views import SignupView, LoginView, UserDetailView, add_password, get_passwords
from .views import (
    SignupView,
    LoginView,
    UserDetailView,
    # passwords_view,
    verify_otp,
    send_otp_email,
    add_password,
    ImageUploadView,
    ImageListView,
    VerifyFaceId,
)
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("signup/", SignupView.as_view(), name="signup"),
    path("login/", LoginView.as_view(), name="login"),
    path("me/", UserDetailView.as_view(), name="user-detail"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # TODO
    path(
        "verify-otp/", verify_otp, name="verify_otp"
    ),  # path("api/users/passwords/", get_passwords, name="get_passwords"),
    path(
        "send-otp-email/", send_otp_email, name="send_otp_email"
    ),  # URL for sending OTP
    # TODO
    # path("verify-otp/", verify_otp, name="verify_otp"),
    path("add_password/", add_password, name="add_password"),
    path("image-upload/", ImageUploadView.as_view(), name="image_upload"),
    path("image/", ImageListView.as_view(), name="view_image"),
    path("verify-face-id/", VerifyFaceId.as_view(), name="verify_face_id"),
]
