"""FastAPI application for IdentityShield backend."""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

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

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "IdentityShield"}


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

        # Initialize conversation
        opening = conversation_manager.start_conversation(session_id)

        return EnrollmentStartResponse(
            session_id=session_id,
            user_id=user_id,
            message=opening
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


# ============== Conversation Endpoints ==============

@app.post("/api/conversation/message", response_model=ConversationMessageResponse)
async def send_message(request: ConversationMessageRequest):
    """
    Send a message to the AI conversation.

    Returns AI response and indicates if conversation should end.
    """
    try:
        response, should_end, progress = await conversation_manager.get_response(
            session_id=request.session_id,
            user_message=request.message,
            elapsed_time=request.elapsed_time
        )

        return ConversationMessageResponse(
            response=response,
            should_end=should_end,
            objectives_progress=progress
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in conversation: {e}")
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
async def get_verification_history(user_id: str, limit: int = 10):
    """Get verification history for a user."""
    try:
        user = await db.get_user(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        history = await verification_service.get_verification_history(user_id, limit)
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
