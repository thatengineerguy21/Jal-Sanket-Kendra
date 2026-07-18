"""Initial schema - baseline from existing ORM models.

Revision ID: 001_initial
Revises: None
Create Date: 2026-07-18
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "water_samples",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("village_code", sa.String(), nullable=True),
        sa.Column("state", sa.String(), nullable=True),
        sa.Column("district", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("fe", sa.Float(), nullable=True),
        sa.Column("as_", sa.Float(), nullable=True),
        sa.Column("u", sa.Float(), nullable=True),
        sa.Column("hmpi_bis", sa.Float(), nullable=True),
        sa.Column("hei_bis", sa.Float(), nullable=True),
        sa.Column("pli_bis", sa.Float(), nullable=True),
        sa.Column("parameters_json", sa.Text(), server_default="{}"),
        sa.Column("standards_json", sa.Text(), server_default="{}"),
        sa.Column("validation_issues_json", sa.Text(), server_default="[]"),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )
    op.create_index("ix_water_samples_village_code", "water_samples", ["village_code"])
    op.create_index("ix_water_samples_state", "water_samples", ["state"])
    op.create_index("ix_water_samples_district", "water_samples", ["district"])
    op.create_index("ix_water_samples_location", "water_samples", ["location"])
    op.create_index("ix_water_samples_year", "water_samples", ["year"])
    op.create_index("ix_water_samples_latitude", "water_samples", ["latitude"])
    op.create_index("ix_water_samples_longitude", "water_samples", ["longitude"])
    op.create_index("ix_water_samples_hmpi_bis", "water_samples", ["hmpi_bis"])

    op.create_table(
        "alert_configs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("hpi_threshold", sa.Float(), server_default="100.0"),
        sa.Column("cd_threshold", sa.Float(), server_default="3.0"),
        sa.Column("email_recipients", sa.Text(), server_default=""),
        sa.Column("sms_recipients", sa.Text(), server_default=""),
        sa.Column("policy_json", sa.Text(), server_default="{}"),
    )

    op.create_table(
        "task_status",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("progress", sa.Integer(), server_default="0"),
        sa.Column("result_json", sa.Text(), server_default="{}"),
        sa.Column("error_message", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime()),
        sa.Column("updated_at", sa.DateTime()),
    )


def downgrade() -> None:
    op.drop_table("task_status")
    op.drop_table("alert_configs")
    op.drop_table("water_samples")
