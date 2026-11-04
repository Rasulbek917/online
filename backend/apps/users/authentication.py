from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieAwareJWTAuthentication(JWTAuthentication):
    """Standard Bearer JWT auth; refresh is handled via a secure HttpOnly cookie."""

    def authenticate(self, request):
        result = super().authenticate(request)
        if result:
            user, _ = result
            if not user.is_active:
                return None
            # Keep the last seen IP for audit purposes without writing on every request.
            forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
            ip = (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR"))
            if ip and user.last_login_ip != ip:
                user.last_login_ip = ip
                user.save(update_fields=["last_login_ip"])
        return result
