from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework import serializers
from .models import CustomUser, Password
from .fields import decrypt
from .permissions import VaultUnlocked


class UserSignupSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True)
    password = serializers.CharField(
        write_only=True, min_length=12, max_length=128, trim_whitespace=False
    )

    class Meta:
        model = CustomUser
        fields = ["username", "phone", "email", "password"]

    def validate_email(self, value):
        value = value.strip().lower()
        if CustomUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Unable to register with these details.")
        return value

    def validate_phone(self, value):
        if not value.isascii() or not value.isdigit() or not 10 <= len(value) <= 15:
            raise serializers.ValidationError("Use 10 to 15 digits.")
        return value

    def validate(self, attrs):
        try:
            validate_password(
                attrs["password"],
                CustomUser(username=attrs["username"], email=attrs["email"]),
            )
        except ValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from None
        return attrs

    def create(self, validated_data):
        return CustomUser.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(max_length=128, trim_whitespace=False)


class OTPSerializer(serializers.Serializer):
    otp = serializers.RegexField(r"^[0-9]{6}$", max_length=6)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ["id", "username", "email"]


class PasswordSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, max_length=4096, trim_whitespace=False
    )

    class Meta:
        model = Password
        fields = ["id", "domain_name", "password", "link"]
        read_only_fields = ["id"]

    def validate_link(self, value):
        if value and not value.startswith(("https://", "http://")):
            raise serializers.ValidationError("Use an HTTP or HTTPS URL.")
        return value


class PasswordReadSerializer(PasswordSerializer):
    def to_representation(self, instance):
        request = self.context.get("request")
        if (
            not request
            or instance.user_id != request.user.pk
            or not VaultUnlocked().has_permission(request, None)
        ):
            raise serializers.ValidationError("Vault is locked.")
        data = super().to_representation(instance)
        data["password"] = decrypt(instance.password)
        return data
