"""Engine, session factory, and demo bootstrap.

SQLite is the zero-credential default. Set DATABASE_URL to a PostgreSQL
connection string (for example Supabase) to run the same models and queries on
Postgres. Alembic owns schema changes; `create_all` is kept as a fast path for
ephemeral test databases.
"""

from collections.abc import Iterator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine, select

from .config import settings

connect_args = (
    {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
)

engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=True,
)


@event.listens_for(Engine, "connect")
def _sqlite_pragmas(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


def create_schema() -> None:
    from .. import models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def init_db() -> None:
    """Make the workspace usable with no migration step on first run."""
    from ..seed import ensure_demo_identity, seed_if_empty

    create_schema()
    with Session(engine) as session:
        seed_if_empty(session)
        ensure_demo_identity(session)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session


def reset_demo(session: Session) -> None:
    """Drop every row and reseed.

    Used by the test harness and local development only. The public reset route
    uses `reset_demo_workspace`, which cannot touch a customer's data.
    """
    from ..seed import ensure_demo_identity, seed_if_empty

    for table in reversed(SQLModel.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    seed_if_empty(session)
    ensure_demo_identity(session)


def reset_demo_workspace(session: Session) -> None:
    """Reset only the seeded demo workspace, never a real customer workspace.

    The demo is shared by every visitor while `ALLOW_PUBLIC_DEMO` is on. A reset
    restores its sample records without deleting another workspace, user, or
    credential. Child rows are deleted through their project/conversation keys
    before the workspace itself disappears.
    """
    from sqlalchemy import delete

    from ..models import Conversation, Project
    from ..seed import USER_ID, WORKSPACE_ID, ensure_demo_identity, seed_if_empty

    project_ids = list(
        session.exec(
            select(Project.id).where(Project.workspace_id == WORKSPACE_ID)
        ).all()
    )
    conversation_ids = list(
        session.exec(
            select(Conversation.id).where(Conversation.workspace_id == WORKSPACE_ID)
        ).all()
    )

    for table in reversed(SQLModel.metadata.sorted_tables):
        columns = set(table.columns.keys())
        if "workspace_id" in columns:
            session.execute(
                delete(table).where(table.columns["workspace_id"] == WORKSPACE_ID)
            )
        elif "project_id" in columns and project_ids:
            session.execute(
                delete(table).where(table.columns["project_id"].in_(project_ids))
            )
        elif "conversation_id" in columns and conversation_ids:
            session.execute(
                delete(table).where(
                    table.columns["conversation_id"].in_(conversation_ids)
                )
            )
        elif table.name == "workspaces":
            session.execute(delete(table).where(table.columns["id"] == WORKSPACE_ID))
        elif table.name == "users":
            session.execute(delete(table).where(table.columns["id"] == USER_ID))
    session.commit()
    seed_if_empty(session)
    ensure_demo_identity(session)
