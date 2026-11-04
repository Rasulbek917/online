import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger("apps.errors")

ERROR_CODES = {
    status.HTTP_400_BAD_REQUEST: "bad_request",
    status.HTTP_401_UNAUTHORIZED: "unauthorized",
    status.HTTP_403_FORBIDDEN: "forbidden",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_409_CONFLICT: "conflict",
    status.HTTP_429_TOO_MANY_REQUESTS: "rate_limited",
    status.HTTP_500_INTERNAL_SERVER_ERROR: "server_error",
}


def _normalize_detail(detail):
    if isinstance(detail, dict):
        return {key: _normalize_detail(value) for key, value in detail.items()}
    if isinstance(detail, (list, tuple)):
        return [_normalize_detail(item) for item in detail]
    return str(detail)


def api_exception_handler(exc, context):
    """Return one predictable error envelope and never leak internals in production."""
    response = exception_handler(exc, context)
    if response is None:
        logger.exception("Unhandled API exception", exc_info=exc)
        return Response(
            {
                "error": {
                    "code": "server_error",
                    "message": "An unexpected error occurred.",
                    "detail": {},
                }
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    detail = _normalize_detail(response.data)
    message = "Request failed."
    if isinstance(detail, list) and detail:
        message = str(detail[0])
    elif isinstance(detail, dict):
        if "detail" in detail:
            message = str(detail["detail"])
        elif "non_field_errors" in detail:
            non_field = detail["non_field_errors"]
            message = str(non_field[0] if isinstance(non_field, list) else non_field)
        else:
            first_key = next(iter(detail))
            value = detail[first_key]
            message = f"{first_key}: {value[0] if isinstance(value, list) else value}"

    code = ERROR_CODES.get(response.status_code, "api_error")
    if isinstance(exc, exceptions.ValidationError):
        code = "validation_error"
    if isinstance(exc, (Http404, DjangoPermissionDenied)):
        code = "not_found" if isinstance(exc, Http404) else "forbidden"

    response.data = {
        "error": {
            "code": code,
            "message": message,
            "detail": detail,
        }
    }
    return response
