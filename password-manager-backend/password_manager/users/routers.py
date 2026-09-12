from django.db import connections
from django.conf import settings
from django.contrib.auth.models import AnonymousUser


class UserDatabaseRouter:
    def db_for_read(self, model, **hints):
        """Direct read queries to the user's schema in PostgreSQL."""
        return self.get_user_db_schema()

    def db_for_write(self, model, **hints):
        """Direct write queries to the user's schema in PostgreSQL."""
        return self.get_user_db_schema()

    def get_user_db_schema(self):
        """Return the schema name based on the logged-in user."""
        user = self.get_authenticated_user()

        if user and user.is_authenticated:
            schema_name = f"user_{user.id}_schema"
            if not self.schema_exists(schema_name):
                self.create_user_schema(schema_name)
            return schema_name
        return "public"  # Default schema

    def get_authenticated_user(self):
        """Fetch the authenticated user from the request context."""
        return getattr(
            self, "user", AnonymousUser()
        )  # Replace with actual user context logic

    def schema_exists(self, schema_name):
        """Check if the schema already exists."""
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute(
                    "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                    [schema_name],
                )
                return cursor.fetchone() is not None
        except Exception as e:
            print(f"Error checking schema existence: {e}")
            return False

    def create_user_schema(self, schema_name):
        """Create a new schema for the user."""
        try:
            with connections["default"].cursor() as cursor:
                cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name}")
        except Exception as e:
            print(f"Error creating schema: {e}")
            raise

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """Allow migrations to be applied to the user's schema."""
        if db == self.get_user_db_schema():
            return True
        return None
