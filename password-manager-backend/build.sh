#!/usr/bin/env bash
# Exit on error
set -o errexit

# Navigate to the inner project directory
cd password_manager

# Install dependencies
pip install -r requirements.production.txt

# Convert static asset files
python manage.py collectstatic --no-input

# Apply any outstanding database migrations
python manage.py migrate
