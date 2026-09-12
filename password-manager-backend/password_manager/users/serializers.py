from rest_framework import serializers
from .models import CustomUser, Password


class UserSignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = CustomUser
        fields = [
            "username",
            "phone",
            "email",
            "password",
        ]

    def validate_email(self, value):
        """Ensure email is always stored in lowercase."""
        return value.strip().lower()

    def validate_phone(self, value):
        """Validate phone number format."""
        # Remove any non-digit characters
        cleaned_phone = ''.join(filter(str.isdigit, value))
        
        # Check if the phone number is between 10 and 15 digits
        if not (10 <= len(cleaned_phone) <= 15):
            raise serializers.ValidationError("Phone number must be between 10 and 15 digits.")
            
        return cleaned_phone

    def create(self, validated_data):
        password = validated_data.pop("password", None)

        if not password:
            raise serializers.ValidationError({"password": "Password is required."})

        # Ensure email is lowercase
        validated_data["email"] = validated_data["email"].strip().lower()

        user = CustomUser(**validated_data)
        user.set_password(password)  # Hash the password before saving
        user.save()

        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            "id",
            "username",
            "email",
        ]  # Include only the fields needed for user details


class PasswordSerializer(serializers.ModelSerializer):
    class Meta:
        model = Password
        fields = [
            "domain_name",
            "password",
            "link",
        ]  # Fields for storing passwords and associated info


class ImageUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = [
            "face_image",
        ]


from .models import Image


class ImageSerializer(serializers.ModelSerializer):
    # Don't include image_data in the serializer by default (it's large binary data)
    # Include metadata instead
    class Meta:
        model = Image
        fields = ["id", "filename", "content_type", "uploaded_at", "user"]
