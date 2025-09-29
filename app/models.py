# app/models.py

from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from sqlalchemy.sql import func
from sqlalchemy import DateTime, Text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

# Define the database connection URL. For this example, we use a local SQLite file.
# For production, you would replace this with your PostgreSQL connection string.
DATABASE_URL = "sqlite:///./water_quality.db"

# Create the SQLAlchemy engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# SessionLocal will be the database session class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for our declarative models
Base = declarative_base()


class WaterSample(Base):
    """
    Represents the raw data for a single water sample point.
    """
    __tablename__ = "water_samples"

    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Metal concentrations in µg/L
    arsenic = Column(Float, name="As")
    cadmium = Column(Float, name="Cd")
    lead = Column(Float, name="Pb")
    zinc = Column(Float, name="Zn")

    # Establish a one-to-one relationship with the results
    result = relationship("PollutionResult", back_populates="sample", uselist=False)


class PollutionResult(Base):
    """
    Stores the calculated pollution indices for a corresponding water sample.
    """
    __tablename__ = "pollution_results"

    id = Column(Integer, primary_key=True, index=True)
    sample_id = Column(Integer, ForeignKey("water_samples.id"))

    heavy_metal_pollution_index = Column(Float, name="HPI")
    hpi_category = Column(String)

    degree_of_contamination = Column(Float, name="Cd_value")
    cd_category = Column(String)

    # Establish the reverse relationship
    sample = relationship("WaterSample", back_populates="result")


class User(Base):
    """
    Basic user model for authentication with role support.
    Roles: 'Admin', 'Analyst', 'Viewer'.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="Viewer", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AlertConfig(Base):
    """
    Stores alert configuration such as thresholds and routing policies.
    Keys for providers are read from environment variables, not stored.
    """
    __tablename__ = "alert_configs"

    id = Column(Integer, primary_key=True, index=True)
    hpi_threshold = Column(Float, default=100.0)
    cd_threshold = Column(Float, default=3.0)
    email_recipients = Column(Text, default="")  # comma-separated emails
    sms_recipients = Column(Text, default="")    # comma-separated phone numbers
    policy_json = Column(Text, default="{}")     # optional JSON string for region policies


def get_db():
    """
    Dependency function to get a database session for each request.
    Ensures the session is closed after the request is finished.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()