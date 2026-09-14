from time import time
from rest_framework.authentication import SessionAuthentication

class CookieSessionAuthentication(SessionAuthentication):
    def authenticate(self, request):
        if request.session.get('login_at', 0) + 12 * 3600 < time():
            request.session.flush()
            return None
        return super().authenticate(request)
    def authenticate_header(self, request):
        return 'Session'
