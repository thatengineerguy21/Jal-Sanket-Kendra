import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Corrected import: 'app' is imported from 'main.py' in the root directory
from main import app
# The imports for models are correct as they are inside the 'app' package
from app.models import Base, get_db

# --- Test Database Setup ---
# Use an in-memory SQLite database for testing to ensure isolation and speed.
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# --- Fixtures ---

@pytest.fixture(scope="function")
def db_session():
    """
    Fixture to provide a clean database session for each test function.
    It creates tables, yields the session, and then drops the tables after the test.
    """
    # Create the database tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop all tables to ensure a clean state for the next test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """
    Fixture to provide a TestClient instance that uses the test database.
    This overrides the `get_db` dependency for the duration of the test.
    """

    def override_get_db():
        """
        A dependency override that provides the test database session.
        """
        try:
            yield db_session
        finally:
            db_session.close()

    # Apply the override
    app.dependency_overrides[get_db] = override_get_db

    # Yield the test client
    yield TestClient(app)

    # Clean up the override after the test
    del app.dependency_overrides[get_db]

