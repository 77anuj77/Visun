"""Engine, session factory, and demo bootstrap.

SQLite is the zero-credential default. Set DATABASE_URL to a PostgreSQL
connection string (for example Supabase) to run the same models and queries on
Postgres. Alembic owns schema changes; `create_all` is kept as a fast path for
ephemeral test databases.
"""

from collections.abc import Iterator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

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
    """Drop every row and reseed. Used only by the explicit demo reset route."""
    from ..seed import seed_if_empty

    for table in reversed(SQLModel.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    seed_if_empty(session)
