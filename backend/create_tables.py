from app.database.base import Base
from app.database.connection import engine
import app.models  # Registers all 9 models with Base.metadata


def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    print("All database tables created successfully!")


if __name__ == "__main__":
    create_tables()