"""Configuration settings for IdentityShield backend."""
import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
EMBEDDINGS_DIR.mkdir(exist_ok=True)

# Database
DATABASE_PATH = os.getenv("DATABASE_PATH", str(DATA_DIR / "identityshield.db"))

# API Keys
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

# Model settings
CLAUDE_MODEL = "claude-sonnet-4-20250514"

# Audio processing
AUDIO_SAMPLE_RATE = 16000  # 16kHz for voice embeddings
VOICE_EMBEDDING_INTERVAL = 3  # Extract embedding every 3 seconds

# Video processing
FRAME_EXTRACTION_FPS = 2  # Extract 2 frames per second
VIDEO_CHUNK_DURATION = 10  # 10-second chunks from frontend

# Enrollment settings
MIN_ENROLLMENT_DURATION = 60  # Minimum 1 minute for MVP
TARGET_ENROLLMENT_DURATION = 300  # Target 5 minutes
MAX_ENROLLMENT_DURATION = 420  # Max 7 minutes

# Verification thresholds
VERIFICATION_THRESHOLD = 0.7  # Overall confidence threshold
VOICE_WEIGHT = 0.30
FACE_WEIGHT = 0.25
SYNC_WEIGHT = 0.25
SPEECH_WEIGHT = 0.20

# Anomaly detection thresholds
SYNC_STD_DEV_THRESHOLD = 2.0  # Flag if sync score > 2 std devs from baseline
SPEECH_RATE_DEVIATION_THRESHOLD = 0.4  # Flag if speech rate differs by 40%
