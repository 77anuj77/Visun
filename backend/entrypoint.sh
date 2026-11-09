#!/bin/sh
set -eu

# Apply Alembic migrations before the API starts. This is safe on a fresh
# database and applies pending revisions on upgrades. The app also calls
# create_all at startup for local development, but the container relies on
# migrations as the source of truth.
alembic upgrade head

exec "$@"
