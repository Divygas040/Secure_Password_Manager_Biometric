from django.contrib import admin
from django.urls import include, path
from users.views import health

urlpatterns = [
    path("health/", health),
    path("admin/", admin.site.urls),
    path("api/users/", include("users.urls")),
]
