import os
import json
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
    Text,
    text
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
    current_stage = Column(String(64), default="queued") # "queued" | "Extracting Audio" | "Transcribing" | "Transcribed" | "Scanning Scenes" | "Scanned Scenes" | "Completed"
    progress = Column(Integer, default=0) # 0 to 100
    message = Column(String(512), default="Job queued")
    file_path = Column(String(1024), nullable=True)
    file_size = Column(Integer, nullable=True)
    mime_type = Column(String(64), nullable=True)
    error = Column(Text, nullable=True)
    policy_warning = Column(Text, nullable=True)
    transcript_json = Column(Text, nullable=True) # Serialized transcript with words, times, and speaker labels
    scenes_json = Column(Text, nullable=True) # Serialized scene cuts with timecodes
    retry_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        transcript_data = None
        if self.transcript_json:
            try:
                transcript_data = json.loads(self.transcript_json)
            except Exception:
                transcript_data = self.transcript_json

        scenes_data = None
        if self.scenes_json:
            try:
                scenes_data = json.loads(self.scenes_json)
            except Exception:
                scenes_data = self.scenes_json

        return {
            "job_id": self.id,
            "video_id": self.video_id,
            "type": self.job_type,
            "source": self.source,
            "status": self.status,
            "current_stage": self.current_stage,
            "progress": self.progress,
            "message": self.message,
            "file_path": self.file_path,
            "file_size": self.file_size,
            "mime_type": self.mime_type,
            "error": self.error,
            "policy_warning": self.policy_warning,
            "transcript": transcript_data,
            "scenes": scenes_data,
            "retry_count": self.retry_count,
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
    """Initialize database tables and run lightweight migrations for SQLite."""
    Base.metadata.create_all(bind=engine)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("PRAGMA table_info(jobs)"))
            existing_cols = {row[1] for row in result.fetchall()}
            
            columns_to_add = {
                "current_stage": "VARCHAR(64) DEFAULT 'queued'",
                "transcript_json": "TEXT",
                "scenes_json": "TEXT",
                "retry_count": "INTEGER DEFAULT 0"
            }
            for col_name, col_type in columns_to_add.items():
                if col_name not in existing_cols:
                    conn.execute(text(f"ALTER TABLE jobs ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                    logger.info(f"Added column {col_name} to jobs table")
    except Exception as e:
        logger.warning(f"Error during SQLite schema check/migration: {e}")
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
            current_stage="queued",
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
    current_stage: Optional[str] = None,
    progress: Optional[int] = None,
    message: Optional[str] = None,
    error: Optional[str] = None,
    retry_count: Optional[int] = None
) -> Optional[JobModel]:
    """Update job status, current stage, and progress."""
    with SessionLocal() as db:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job:
            return None
        if status:
            job.status = status
        if current_stage:
            job.current_stage = current_stage
        if progress is not None:
            job.progress = progress
        if message:
            job.message = message
        if error is not None:
            job.error = error
        if retry_count is not None:
            job.retry_count = retry_count
        job.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

def db_save_transcript(job_id: str, transcript_data: Any) -> Optional[JobModel]:
    """Save transcript JSON into job record."""
    with SessionLocal() as db:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job:
            return None
        job.transcript_json = json.dumps(transcript_data, default=str)
        job.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(job)
        return job

def db_save_scenes(job_id: str, scenes_data: Any) -> Optional[JobModel]:
    """Save detected scene list JSON into job record."""
    with SessionLocal() as db:
        job = db.query(JobModel).filter(JobModel.id == job_id).first()
        if not job:
            return None
        job.scenes_json = json.dumps(scenes_data, default=str)
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
