import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any
from sqlalchemy import (
    create_engine,
    Column,
    String,
    Integer,
    DateTime,
    Text
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings
from app.core.logger import logger

Base = declarative_base()

class JobModel(Base):
    __tablename__ = "jobs"

    id = Column(String(64), primary_key=True, index=True)
    video_id = Column(String(64), index=True)
    job_type = Column(String(32), default="file_upload") # "file_upload" | "youtube_url"
    source = Column(String(512)) # filename or youtube url
    status = Column(String(32), default="queued", index=True) # "queued" | "processing" | "completed" | "failed"
    progress = Column(Integer, default=0) # 0 to 100
    message = Column(String(512), default="Job queued")
    file_path = Column(String(1024), nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(64), nullable=True)
    error = Column(Text, nullable=True)
    policy_warning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.id,
            "video_id": self.video_id,
            "type": self.job_type,
            "source": self.source,
            "status": self.status,
            "progress": self.progress,
            "message": self.message,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "error": self.error,
            "policy_warning": self.policy_warning,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

# SQLite database path in backend/storage/jobs.db
DB_FILE = settings.STORAGE_DIR / "jobs.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
    logger.info(f"Database initialized at {DB_FILE}")

def get_db():
    """Dependency helper for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def db_create_job(
    video_id: str,
    job_type: str,
    source: str,
    file_path: Optional[str] = None,
    file_size: Optional[int] = None,
    mime_type: Optional[str] = None,
    status: str = "queued",
    message: str = "Upload successful, job queued",
    policy_warning: Optional[str] = None
) -> JobModel:
    """Create and persist a new job record."""
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    with SessionLocal() as db:
        job = JobModel(
            id=job_id,
            video_id=video_id,
            job_type=job_type,
            source=source,
            status=status,
            progress=0 if status == "queued" else 100,
            message=message,
            file_path=file_path,
            file_size=file_size,
            mime_type=mime_type,
            policy_warning=policy_warning
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        logger.info(f"Enqueued job {job_id} for video_id {video_id} with status '{status}'")
        return job

def db_get_job(job_id: str) -> Optional[JobModel]:
    """Retrieve job by ID."""
    with SessionLocal() as db:
        return db.query(JobModel).filter(JobModel.id == job_id).first()

def db_update_job(
    job_id: str,
    status: Optional[str] = None,
    progress: Optional[int] = None,
    message: Optional[str] = None,
    error: Optional[str] = None
) -> Optional[JobModel]:
    """Update job status and progress."""
    with SessionLocal() as db:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job:
            return None
        if status:
            job.status = status
        if progress is not None:
            job.progress = progress
        if message:
            job.message = message
        if error:
            job.error = error
        job.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

def db_list_recent_jobs(limit: int = 20) -> List[JobModel]:
    """List most recent jobs."""
    with SessionLocal() as db:
        return db.query(JobModel).order_by(JobModel.created_at.desc()).limit(limit).all()

# Ensure tables are created on import
init_db()
