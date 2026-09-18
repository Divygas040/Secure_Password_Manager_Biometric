"""Camera face comparison is a demo secondary factor, without liveness detection."""

import json
import warnings
from io import BytesIO
import numpy as np
from PIL import Image, UnidentifiedImageError
from django.conf import settings
from rest_framework.exceptions import ValidationError, APIException
from .fields import decrypt


class BiometricUnavailable(APIException):
    status_code = 503
    default_detail = "Face verification is unavailable. Please try again."


def extract_encoding(upload):
    if (
        upload is None
        or upload.size > settings.MAX_FACE_IMAGE_BYTES
        or upload.size == 0
    ):
        raise ValidationError("Provide a JPEG or PNG image up to 2 MB.")
    try:
        data = upload.read(settings.MAX_FACE_IMAGE_BYTES + 1)
        if len(data) > settings.MAX_FACE_IMAGE_BYTES:
            raise ValueError
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(data)) as image:
                if (
                    image.format not in ("JPEG", "PNG")
                    or image.width * image.height > settings.MAX_FACE_IMAGE_PIXELS
                ):
                    raise ValueError
                image.load()
                image.thumbnail((800, 800))
                pixels = np.array(image.convert("RGB"))
    except (
        ValueError,
        OSError,
        UnidentifiedImageError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ):
        raise ValidationError(
            "Provide a valid JPEG or PNG within the image limits."
        ) from None
    try:
        import face_recognition
    except ImportError:
        raise BiometricUnavailable from None
    locations = face_recognition.face_locations(pixels, model="hog")
    if len(locations) != 1:
        raise ValidationError("The image must contain exactly one clear face.")
    encodings = face_recognition.face_encodings(pixels, locations)
    if len(encodings) != 1:
        raise ValidationError("Unable to verify this image.")
    return encodings[0].tolist()


def matches(stored, submitted):
    saved = np.asarray(
        json.loads(decrypt(stored, "BIOMETRIC_ENCRYPTION_KEY")), dtype=float
    )
    candidate = np.asarray(submitted, dtype=float)
    if (
        saved.shape != (128,)
        or candidate.shape != (128,)
        or not np.isfinite(saved).all()
        or not np.isfinite(candidate).all()
    ):
        return False
    return bool(np.linalg.norm(saved - candidate) <= 0.4)
