"""Create the initial HighLyAgent schema."""
from __future__ import annotations
from alembic import op
from sqlalchemy import text
from highlyagent.core import Base
import highlyagent.models  # noqa: F401 - register model metadata

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)

def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
