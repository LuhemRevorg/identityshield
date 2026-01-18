"""FastAPI application for IdentityShield backend."""
import logging
import os
import base64
import tempfile
import uuid
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional

import httpx
import bcrypt
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
load_dotenv()

from database.db import db
from database.schemas import (
    EnrollmentStartRequest,
    EnrollmentChunkRequest,
    EnrollmentCompleteRequest,
    ConversationMessageRequest,
    EnrollmentStartResponse,
    EnrollmentChunkResponse,
    EnrollmentCompleteResponse,
    ConversationMessageResponse,
    ProfileResponse,
    VerifyResponse,
    RegisterRequest,
    LoginRequest,
    AuthResponse,
    UserResponse,
)
from services.enrollment import enrollment_service
from services.verification import verification_service
from services.conversation import conversation_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("Starting IdentityShield backend...")
    await db.connect()
    logger.info("Database connected")
    yield
    # Shutdown
    logger.info("Shutting down...")
    await db.close()


app = FastAPI(
    title="IdentityShield API",
    description="Personal deepfake detection system API",
    version="1.0.0",
    lifespan=lifespan
)

assets_dir = Path(__file__).resolve().parent / "assets"
if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Password hashing helpers
def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a hash."""
    return bcrypt.checkpw(password.encode(), password_hash.encode())


# Session duration
SESSION_DURATION_DAYS = 30


# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "IdentityShield"}


# ============== Auth Endpoints ==============

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(request: RegisterRequest):
    """Register a new user."""
    try:
        # Check if email already exists
        existing_user = await db.get_user_by_email(request.email)
        if existing_user:
            return AuthResponse(success=False, message="Email already registered")

        # Create user
        user_id = str(uuid.uuid4())
        hashed = hash_password(request.password)
        user = await db.create_user_with_password(
            user_id=user_id,
            email=request.email,
            password_hash=hashed,
            name=request.name
        )

        # Create session
        session_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS)
        await db.create_auth_session(session_id, user_id, expires_at)

        return AuthResponse(
            success=True,
            user_id=user_id,
            session_token=session_id,
            name=user.name,
            email=user.email
        )
    except Exception as e:
        logger.error(f"Error registering user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: LoginRequest):
    """Login user."""
    try:
        # Find user by email
        user = await db.get_user_by_email(request.email)
        if not user or not user.password_hash:
            return AuthResponse(success=False, message="Invalid email or password")

        # Verify password
        if not verify_password(request.password, user.password_hash):
            return AuthResponse(success=False, message="Invalid email or password")

        # Create session
        session_id = str(uuid.uuid4())
        expires_at = datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS)
        await db.create_auth_session(session_id, user.id, expires_at)

        return AuthResponse(
            success=True,
            user_id=user.id,
            session_token=session_id,
            name=user.name,
            email=user.email
        )
    except Exception as e:
        logger.error(f"Error logging in: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/logout")
async def logout(session_token: str = Form(...)):
    """Logout user."""
    try:
        await db.delete_auth_session(session_token)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error logging out: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user(session_token: str):
    """Get current user from session token."""
    try:
        # Get session
        session = await db.get_auth_session(session_token)
        if not session:
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        # Check if expired
        if session.expires_at < datetime.utcnow():
            await db.delete_auth_session(session_token)
            raise HTTPException(status_code=401, detail="Session expired")

        # Get user
        user = await db.get_user(session.user_id)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        # Check if user has a profile (embeddings)
        embedding_counts = await db.get_embedding_counts(user.id)
        has_profile = sum(embedding_counts.values()) > 0

        return UserResponse(
            user_id=user.id,
            email=user.email or "",
            name=user.name,
            created_at=user.created_at,
            has_profile=has_profile
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting current user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Enrollment Endpoints ==============

@app.post("/api/enrollment/start", response_model=EnrollmentStartResponse)
async def start_enrollment(request: EnrollmentStartRequest):
    """
    Start a new enrollment session.

    Creates a new user if user_id not provided.
    Returns session_id for subsequent chunk uploads.
    """
    try:
        session_id, user_id = await enrollment_service.start_session(
            user_id=request.user_id,
            email=request.email
        )

        # Initialize conversation with topic
        opening, audio_base64 = await conversation_manager.start_conversation(
            session_id=session_id,
            topic=request.topic or "General Chat"
        )

        return EnrollmentStartResponse(
            session_id=session_id,
            user_id=user_id,
            message=opening,
            audio_base64=audio_base64
        )
    except Exception as e:
        logger.error(f"Error starting enrollment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/enrollment/chunk", response_model=EnrollmentChunkResponse)
async def upload_chunk(request: EnrollmentChunkRequest, background_tasks: BackgroundTasks):
    """
    Upload a video chunk during enrollment.

    Processes video in background to extract embeddings.
    """
    try:
        # Process synchronously for now (could be moved to background)
        result = await enrollment_service.process_chunk(
            session_id=request.session_id,
            video_chunk=request.video_chunk
        )

        if not result.get("success"):
            return EnrollmentChunkResponse(
                success=False,
                chunks_processed=0,
                message=result.get("error", "Processing failed")
            )

        session = enrollment_service.active_sessions.get(request.session_id)
        chunks = session.chunks_processed if session else 0

        return EnrollmentChunkResponse(
            success=True,
            chunks_processed=chunks,
            message=f"Processed: {result.get('voice_embeddings', 0)} voice, {result.get('face_embeddings', 0)} face samples"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error processing chunk: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/enrollment/complete", response_model=EnrollmentCompleteResponse)
async def complete_enrollment(request: EnrollmentCompleteRequest):
    """
    Complete an enrollment session.

    Finalizes profile and computes aggregated embeddings.
    """
    try:
        result = await enrollment_service.complete_session(request.session_id)

        # End conversation
        conversation_manager.end_conversation(request.session_id)

        return EnrollmentCompleteResponse(
            success=result["success"],
            profile_strength=result["profile_strength"],
            embeddings_collected=result["embeddings_collected"],
            message=f"Profile created with {result['profile_strength']:.0%} strength"
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error completing enrollment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Profile Endpoints ==============

@app.get("/api/profile/{user_id}", response_model=ProfileResponse)
async def get_profile(user_id: str):
    """Get user profile information and strength."""
    try:
        user = await db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        profile_data = await enrollment_service.get_profile_strength(user_id)

        return ProfileResponse(
            user_id=user_id,
            strength_score=profile_data["strength_score"],
            sessions_count=profile_data["sessions_count"],
            last_updated=profile_data.get("last_updated"),
            feature_coverage=profile_data["feature_coverage"],
            total_voice_samples=profile_data.get("total_voice_samples", 0),
            total_face_samples=profile_data.get("total_face_samples", 0)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{user_id}")
async def get_user_sessions(user_id: str):
    """Get enrollment sessions for a user."""
    try:
        user = await db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        sessions = await db.get_user_sessions(user_id)

        return {
            "sessions": [
                {
                    "id": s.id,
                    "started_at": s.started_at.isoformat(),
                    "completed_at": s.completed_at.isoformat() if s.completed_at else None,
                    "duration_seconds": s.duration_seconds,
                    "objectives_covered": s.objectives_covered
                }
                for s in sessions
            ]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Conversation Endpoints ==============

@app.post("/api/conversation/message", response_model=ConversationMessageResponse)
async def send_message(request: ConversationMessageRequest):
    """
    Send a message to the AI conversation.

    Returns AI response and indicates if conversation should end.
    """
    try:
        response, should_end, progress, audio_base64 = await conversation_manager.get_response(
            session_id=request.session_id,
            user_message=request.message,
            elapsed_time=request.elapsed_time
        )

        return ConversationMessageResponse(
            response=response,
            should_end=should_end,
            objectives_progress=progress,
            audio_base64=audio_base64
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Transcription Endpoint ==============

class TranscribeRequest(BaseModel):
    audio_base64: str  # Base64 encoded audio (webm/mp3/wav)


class TranscribeResponse(BaseModel):
    text: str
    success: bool


@app.post("/api/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """
    Transcribe audio using Groq's Whisper API.
    """
    try:
        groq_api_key = os.getenv("GROQ_API_KEY", "")
        if not groq_api_key:
            raise HTTPException(status_code=500, detail="Groq API key not configured")

        # Decode base64 audio
        audio_data = base64.b64decode(request.audio_base64)

        # Save to temp file (Groq requires file upload)
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_data)
            temp_path = f.name

        try:
            # Call Groq Whisper API
            async with httpx.AsyncClient(timeout=60.0) as client:
                with open(temp_path, "rb") as audio_file:
                    files = {"file": ("audio.webm", audio_file, "audio/webm")}
                    data = {"model": "whisper-large-v3"}

                    response = await client.post(
                        "https://api.groq.com/openai/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {groq_api_key}"},
                        files=files,
                        data=data,
                    )

                    if response.status_code != 200:
                        logger.error(f"Groq Whisper error: {response.status_code} - {response.text}")
                        raise HTTPException(status_code=500, detail="Transcription failed")

                    result = response.json()
                    transcript = result.get("text", "").strip()

                    return TranscribeResponse(text=transcript, success=bool(transcript))
        finally:
            # Clean up temp file
            os.unlink(temp_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============== Verification Endpoints ==============

@app.post("/api/verify", response_model=VerifyResponse)
async def verify_content(
    user_id: str = Form(...),
    file: UploadFile = File(...)
):
    """
    Verify uploaded video/audio against user's profile.

    Returns authenticity verdict with confidence breakdown.
    """
    try:
        # Validate user exists
        user = await db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Read file content
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(status_code=400, detail="Empty file")

        # Verify content
        result = await verification_service.verify_content(
            user_id=user_id,
            file_content=content,
            filename=file.filename or "unknown"
        )

        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error verifying content: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/verify/history/{user_id}")
async def get_verification_history(user_id: str, request: Request, limit: int = 10):
    """Get verification history for a user."""
    try:
        user = await db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        history = await verification_service.get_verification_history(user_id, limit)
        base_url = str(request.base_url).rstrip("/")
        for item in history:
            file_url = item.get("file_url")
            if file_url and file_url.startswith("/"):
                item["file_url"] = f"{base_url}{file_url}"
        return {"history": history}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Run with: uvicorn main:app --reload --host 0.0.0.0 --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
