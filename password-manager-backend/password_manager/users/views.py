import os
import pyotp
import numpy as np
from io import BytesIO
from PIL import Image as PILImage
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    face_recognition = None
from pathlib import Path
from datetime import datetime

from django.conf import settings
from rest_framework import status
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.template.loader import render_to_string
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes

from .serializers import (
    UserSignupSerializer,
    UserSerializer,
    PasswordSerializer,
    ImageUploadSerializer,
    ImageSerializer,
)
from .models import Password, CustomUser, Image

User = get_user_model()  # Get custom user model


# ✅ Signup API with Face Image Processing & Secure Storage
class SignupView(APIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = UserSignupSerializer

    def post(self, request):
        serializer = self.serializer_class(data=request.data)
        
        # Print request data for debugging
        print("Signup request data:", request.data)

        if serializer.is_valid():
            validated_data = serializer.validated_data
            validated_data["email"] = validated_data["email"].strip().lower()

            if User.objects.filter(email=validated_data["email"]).exists():
                return Response(
                    {"error": "Email already registered!"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            user = serializer.save()

            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    "message": "Signup successful!",
                    "token": str(refresh.access_token),
                    "refresh": str(refresh),
                    "token_expires_in": refresh.access_token.payload["exp"],
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        # Print detailed validation errors
        print("Validation errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ✅ Login API (Authenticates User Securely)
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get("email", "").strip().lower()  # ✅ Convert to lowercase
        password = request.data.get("password")

        if not email or not password:
            return Response(
                {"error": "Email and Password are required!"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(
                email__iexact=email
            )  # Case-insensitive email lookup
        except User.DoesNotExist:
            return Response(
                {"error": "Invalid credentials!"}, status=status.HTTP_400_BAD_REQUEST
            )

        if not check_password(password, user.password):  # Verify the hashed password
            return Response(
                {"error": "Invalid credentials!"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Generate JWT Token
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Login successful!",
                "token": str(refresh.access_token),
                "refresh": str(refresh),
                "token_expires_in": refresh.access_token.payload["exp"],
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
            },
            status=status.HTTP_200_OK,
        )


# ✅ User Profile API (Fetches Logged-in User Details)
class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserSerializer(user)
        return Response(serializer.data)


# ✅ Root API (Provide basic API info)
@api_view(["GET"])
@permission_classes([AllowAny])  # No authentication required for this view
def api_root(request):
    return Response(
        {
            "message": "Welcome to the API!",
            "endpoints": {
                "users": "/api/users/",
                "signup": "/api/signup/",
                "login": "/api/login/",
                "me": "/api/me/",
                "passwords": "/api/passwords/",
            },
        }
    )


# ✅ Add Password API (Allow authenticated users to add a password)
@api_view(["POST"])
@permission_classes(
    [IsAuthenticated]
)  # Ensure only authenticated users can add passwords
def add_password(request):
    """Allow authenticated users to add a password."""
    # Check if 'domain_name' and 'password' are provided in the request
    if "domain_name" not in request.data or "password" not in request.data:
        return Response(
            {"error": "domain_name and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Create serializer to validate and save the password data
    serializer = PasswordSerializer(data=request.data)

    # Validate and save the password
    if serializer.is_valid():
        try:
            # Save the password for the authenticated user
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            # Handle errors during saving the password
            return Response(
                {"error": f"Error saving password: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    else:
        # Return validation errors if the serializer is not valid
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ✅ Fetch Password API (Allow authenticated users to fetch passwords)
# @api_view(["GET"])
# @permission_classes([IsAuthenticated])
# def get_passwords(request):
#     """Allow authenticated users to get their passwords."""
#     passwords = Password.objects.filter(
#         user=request.user
#     )  # Fetch passwords for authenticated user
#     serializer = PasswordSerializer(passwords, many=True)
#     return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def verify_otp(request):
    """Allow authenticated users to view or add passwords."""
    if request.method == "GET":
        otp = request.query_params.get("otp")  # Get OTP from query params

        if not otp:
            return Response(
                {"error": "OTP is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # # Generate OTP
        user = request.user
        print("OPT", otp, user.otp_generated)
        totp = pyotp.TOTP(user.otp_secret)  # Use the user's OTP secret

        # Now verify OTP entered by the user
        if str(user.otp_generated) != str(otp):
            return Response(
                {"error": "Invalid OTP"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Fetch passwords if OTP is valid
        passwords = Password.objects.filter(user=request.user)
        serializer = PasswordSerializer(passwords, many=True)
        return Response(serializer.data)


# totp = pyotp.TOTP(user.otp_secret, interval=30)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def send_otp_email(request):
    try:
        user = request.user  # Get the logged-in user

        # Generate or fetch OTP secret
        otp_secret = (
            user.generate_otp_secret()
        )  # Generate OTP secret if not already done

        # Generate OTP for the user
        totp = pyotp.TOTP(otp_secret)
        generated_otp = totp.now()  # Generate the OTP

        # Store OTP in the user model (or session for simplicity)
        user.otp_generated = generated_otp  # Save OTP for comparison later
        user.save()

        # Send the OTP to the user's email
        send_mail(
            "Your OTP for Password Access",
            f"Your OTP for accessing your passwords is: {generated_otp}",
            settings.DEFAULT_FROM_EMAIL,  # Sender email (from your settings)
            [user.email],  # Recipient's email
            fail_silently=False,
        )

        return Response(
            {
                "message": "OTP sent successfully to your email!",
                "user": {"email": user.email},
            },
            status=200,
        )

    except Exception as e:
        return Response({"error": str(e)}, status=400)


# @api_view(["GET"])
# @permission_classes([IsAuthenticated])
# def verify_otp(request):
#     """Verify OTP for the logged-in user"""
#     otp = request.query_params.get("otp")  # Get the OTP from query params

#     if not otp:
#         return Response({"error": "OTP is required."}, status=400)

#     user = request.user  # Get the logged-in user

#     # Verify the OTP with the stored OTP
#     if user.otp_generated == otp:
#         # OTP is correct, fetch passwords for the user
#         passwords = Password.objects.filter(
#             user=user
#         )  # Fetch passwords for authenticated user
#         serializer = PasswordSerializer(passwords, many=True)
#         return Response(serializer.data, status=200)
#     else:
#         return Response({"error": "Invalid OTP."}, status=400)


class ImageUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Ensure the request includes the image file
        if not FACE_RECOGNITION_AVAILABLE:
            return Response(
                {"error": "Face recognition is not available. Please install dlib and face_recognition."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        
        user = request.user
        print(f"Processing image upload for user: {user.username}")

        if "image" not in request.FILES:
            return Response(
                {"error": "No image provided."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file = request.FILES["image"]
        print(f"Received image file: {file.name}, size: {file.size} bytes")

        # Validate that the uploaded file contains a clear face
        try:
            # Reset file pointer to beginning
            file.seek(0)
            # Load the image using PIL first, then convert to numpy array
            # This ensures compatibility with Django's UploadedFile
            pil_image = PILImage.open(file)
            # Convert PIL image to RGB if necessary (face_recognition expects RGB)
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            # Convert to numpy array
            image = np.array(pil_image)
            # Reset file pointer again for saving later
            file.seek(0)
            
            # Detect faces
            face_locations = face_recognition.face_locations(image)
            
            print(f"Face locations detected: {face_locations}")
            
            # Check if any face was detected
            if not face_locations:
                return Response(
                    {"error": "No face detected in the uploaded image. Please provide a clear image of your face."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # Check if multiple faces were detected
            if len(face_locations) > 1:
                return Response(
                    {"error": f"Multiple faces ({len(face_locations)}) detected in the image. Please provide an image with only your face."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            
            # Try to generate a face encoding to ensure the face is clear enough
            face_encodings = face_recognition.face_encodings(image, face_locations)
            if not face_encodings:
                return Response(
                    {"error": "Could not generate face encoding. Please provide a clearer image of your face."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
                
            print("Face validation successful")
            
            # Reset file pointer for saving
            file.seek(0)
            
            # Read the file content as bytes
            image_bytes = file.read()
            content_type = file.content_type or 'image/png'
            filename = file.name or 'face.png'

            # Create an image instance and save the image data to database
            try:
                # Delete previous face image if it exists
                try:
                    previous_image = Image.objects.get(user=user)
                    previous_image.delete()
                    print(f"Deleted previous face image for user: {user.username}")
                except Image.DoesNotExist:
                    pass

                # Create new image instance with binary data
                image_instance = Image(
                    user=user,
                    image_data=image_bytes,
                    filename=filename,
                    content_type=content_type
                )
                image_instance.save()
                print(f"New face image saved successfully to database for user: {user.username}")

                # Return success response
                return Response(
                    {
                        "message": "Face image uploaded successfully!",
                        "image_id": image_instance.id,
                    },
                    status=status.HTTP_201_CREATED,
                )
            except Exception as e:
                print(f"Error saving image: {str(e)}")
                return Response(
                    {"error": f"Error saving image: {str(e)}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        except Exception as e:
            import traceback
            error_traceback = traceback.format_exc()
            print(f"Error processing image: {str(e)}")
            print(f"Traceback: {error_traceback}")
            return Response(
                {"error": f"Error processing image: {str(e)}", "details": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


class ImageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        image = Image.objects.get(user=user)
        if not image:
            return Response({"status": False, status: 404})
        serializer = ImageSerializer(image)
        return Response(serializer.data)


class VerifyFaceId(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        if not FACE_RECOGNITION_AVAILABLE:
            return Response(
                {"error": "Face recognition is not available. Please install dlib and face_recognition."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        
        try:
            user = request.user

            if "image" not in request.FILES:
                return Response(
                    {"error": "No image provided."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            uploaded_image = request.FILES["image"]

            # Get faceId from DB
            try:
                image = Image.objects.get(user=user)
            except Image.DoesNotExist:
                return Response(
                    {"error": "No face ID found for this user. Please set up Face ID first."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Process uploaded image
            try:
                # Reset file pointer
                uploaded_image.seek(0)
                # Load using PIL for better compatibility
                pil_image1 = PILImage.open(uploaded_image)
                if pil_image1.mode != 'RGB':
                    pil_image1 = pil_image1.convert('RGB')
                image1 = np.array(pil_image1)
                
                face_locations1 = face_recognition.face_locations(image1)
                
                print(f"Uploaded image face locations: {face_locations1}")
                
                if not face_locations1:
                    return Response(
                        {"error": "No face detected in the uploaded image."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                if len(face_locations1) > 1:
                    print(f"WARNING: Multiple faces ({len(face_locations1)}) detected in uploaded image")
                    return Response(
                        {"error": f"Multiple faces ({len(face_locations1)}) detected in the uploaded image. Please ensure only your face is visible."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                face_encoding1 = face_recognition.face_encodings(image1, face_locations1)[0]
                print(f"Uploaded face encoding generated successfully")
            except Exception as e:
                print(f"Error processing uploaded image: {str(e)}")
                return Response(
                    {"error": f"Error processing uploaded image: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Process saved faceId image from database
            try:
                print(f"Loading saved image from database for user: {user.username}")
                
                # Get image bytes from database
                image_bytes = image.get_image_bytes()
                if not image_bytes:
                    return Response(
                        {"error": "No image data found in database."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                
                # Load image from bytes using PIL
                pil_image2 = PILImage.open(BytesIO(image_bytes))
                if pil_image2.mode != 'RGB':
                    pil_image2 = pil_image2.convert('RGB')
                image2 = np.array(pil_image2)
                
                face_locations2 = face_recognition.face_locations(image2)
                
                print(f"Saved image face locations: {face_locations2}")
                
                if not face_locations2:
                    return Response(
                        {"error": "No face detected in the saved face ID image."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                
                if len(face_locations2) > 1:
                    print(f"WARNING: Multiple faces ({len(face_locations2)}) detected in saved image")
                
                face_encoding2 = face_recognition.face_encodings(image2, face_locations2)[0]
                print(f"Saved face encoding generated successfully")
            except Exception as e:
                return Response(
                    {"error": f"Error processing saved face ID image: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Compare faces
            # Lower tolerance value makes the comparison more strict (default is 0.6)
            tolerance = 0.4  # Making this stricter
            results = face_recognition.compare_faces([face_encoding1], face_encoding2, tolerance=tolerance)
            
            # Also calculate the distance - lower means more similar
            face_distance = face_recognition.face_distance([face_encoding1], face_encoding2)[0]
            print(f"Face distance: {face_distance}, Tolerance: {tolerance}")

            if results[0]:
                return Response({"status": True, "message": "Face ID verified successfully!"})
            else:
                return Response(
                    {"status": False, "error": f"Face ID verification failed. The faces do not match (similarity distance: {face_distance:.4f})."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        except Exception as e:
            return Response(
                {"error": f"An unexpected error occurred: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

