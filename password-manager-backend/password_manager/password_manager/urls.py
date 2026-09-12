"""
URL configuration for password_manager project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from users.views import api_root  # Import the api_root view
from . import views  # Import home view
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),  # Admin panel route
    # Root endpoint for the API (provides information about available endpoints)
    path("api/", api_root, name="api_root"),
    # User-specific API routes (signup, login, passwords, etc.)
    path("api/users/", include("users.urls")),
    # Home route (for your non-API view)
    path("", views.home, name="home"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]


urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
