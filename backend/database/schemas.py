"""Pydantic models for API requests and responses."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class EmbeddingType(str, Enum):
    VOICE = "voice"
    FACE = "face"
    SYNC = "sync"
    SPEECH = "speech"


# Request models
class EnrollmentStartRequest(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None


class EnrollmentChunkRequest(BaseModel):
    session_id: str
    video_chunk: str  # Base64 encoded video


class EnrollmentCompleteRequest(BaseModel):
    session_id: str


class ConversationMessageRequest(BaseModel):
    session_id: str
    message: str
    elapsed_time: float = 0.0  # Seconds since conversation start


class VerifyRequest(BaseModel):
    user_id: str


# Response models
class EnrollmentStartResponse(BaseModel):
    session_id: str
    user_id: str
    message: str


class EnrollmentChunkResponse(BaseModel):
    success: bool
    chunks_processed: int
    message: str


class EnrollmentCompleteResponse(BaseModel):
    success: bool
    profile_strength: float
    embeddings_collected: Dict[str, int]
    message: str


class ConversationMessageResponse(BaseModel):
    response: str
    should_end: bool
    objectives_progress: float  # 0-1 indicating how many objectives covered


class FeatureBreakdown(BaseModel):
    voice_match: float = Field(ge=0, le=1)
    face_match: float = Field(ge=0, le=1)
    lip_sync: float = Field(ge=0, le=1)
    speech_patterns: float = Field(ge=0, le=1)


class VerifyResponse(BaseModel):
    authentic: bool
    confidence: float = Field(ge=0, le=1)
    breakdown: FeatureBreakdown
    anomalies: List[str]
    analysis_details: Optional[Dict[str, Any]] = None


class ProfileResponse(BaseModel):
    user_id: str
    strength_score: float = Field(ge=0, le=1)
    sessions_count: int
    last_updated: Optional[datetime]
    feature_coverage: Dict[str, float]
    total_voice_samples: int
    total_face_samples: int


class SessionInfo(BaseModel):
    id: str
    started_at: datetime
    completed_at: Optional[datetime]
    duration_seconds: Optional[float]
    objectives_covered: List[str]


class VerificationHistory(BaseModel):
    id: str
    verified_at: datetime
    authentic: bool
    confidence: float


# Database models (for internal use)
class UserDB(BaseModel):
    id: str
    created_at: datetime
    email: Optional[str] = None


class EnrollmentSessionDB(BaseModel):
    id: str
    user_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    objectives_covered: List[str] = []


class EmbeddingDB(BaseModel):
    id: str
    user_id: str
    session_id: str
    embedding_type: EmbeddingType
    embedding_data: bytes
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None


class VerificationDB(BaseModel):
    id: str
    user_id: str
    verified_at: datetime
    result: Dict[str, Any]
    file_hash: str
