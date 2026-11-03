"""Baseline schema for every Visun table.

Revision ID: 0001_initial
Revises:
Create Date: 2026-11-03

The baseline is generated from the SQLModel metadata so SQLite and PostgreSQL
receive the same types, constraints, and indexes. Later revisions must be
explicit Alembic operations.
"""

from collections.abc import Sequence

from alembic import op
from sqlmodel import SQLModel

from app import models  # noqa: F401 - registers tables on the metadata

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    SQLModel.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    SQLModel.metadata.drop_all(bind=bind)
