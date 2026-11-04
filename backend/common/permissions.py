from rest_framework import permissions


class IsAdminRole(permissions.BasePermission):
    message = "Administrator access required."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.role == "admin" or request.user.is_superuser)
        )


class IsTeacherRole(permissions.BasePermission):
    message = "Teacher access required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "teacher")


class IsTeacherOrAdmin(permissions.BasePermission):
    message = "Teacher or administrator access required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.role in {"teacher", "admin"} or user.is_superuser)
        )


class IsOwnerOrStaff(permissions.BasePermission):
    message = "You do not have permission to modify this object."

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role in {"admin", "teacher"} or user.is_superuser:
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "student", None)
        return owner == user


class ReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS
