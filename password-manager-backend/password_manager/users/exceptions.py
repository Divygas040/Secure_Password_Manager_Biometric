from rest_framework.views import exception_handler
from rest_framework.response import Response

def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        # Never serialize exception details, input, credentials or template data.
        return Response({'detail': 'The request could not be completed.'}, status=500)
    return response
