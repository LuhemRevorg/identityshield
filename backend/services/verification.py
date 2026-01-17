"""Verification service for comparing suspect content against user profiles."""
import uuid
import hashlib
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
import logging
import numpy as np

from database.db import db
from database.schemas import EmbeddingType, FeatureBreakdown, VerifyResponse
from services.media_processor import media_processor
from models.voice_model import voice_model
from models.face_model import face_model
from models.sync_model import sync_model
from config import (
    VOICE_WEIGHT, FACE_WEIGHT, SYNC_WEIGHT, SPEECH_WEIGHT,
    VERIFICATION_THRESHOLD, SYNC_STD_DEV_THRESHOLD, SPEECH_RATE_DEVIATION_THRESHOLD
)

logger = logging.getLogger(__name__)


class VerificationService:
    """Service for verifying content against user profiles."""

    async def verify_content(
        self, user_id: str, file_content: bytes, filename: str
    ) -> VerifyResponse:
        """
        Verify uploaded content against user's enrolled profile.

        Args:
            user_id: User ID to verify against
            file_content: Raw file bytes
            filename: Original filename

        Returns:
            VerifyResponse with authenticity verdict and breakdown
        """
        # Compute file hash for deduplication
        file_hash = hashlib.sha256(file_content).hexdigest()

        # Load user's profile embeddings
        profile = await self._load_user_profile(user_id)
        if not profile:
            raise ValueError(f"No profile found for user {user_id}")

        # Save content to temp file and process
        temp_path = Path(tempfile.gettempdir()) / f"verify_{uuid.uuid4().hex}{Path(filename).suffix}"
        temp_path.write_bytes(file_content)

        try:
            # Process the video/audio
            test_features = await self._extract_test_features(temp_path)

            # Compare against profile
            comparison = self._compare_to_profile(test_features, profile)

            # Calculate overall confidence
            confidence = self._calculate_confidence(comparison)

            # Detect anomalies
            anomalies = self._detect_anomalies(test_features, profile, comparison)

            # Determine verdict
            authentic = confidence >= VERIFICATION_THRESHOLD and len(anomalies) < 2

            # Build response
            breakdown = FeatureBreakdown(
                voice_match=comparison.get("voice", 0.5),
                face_match=comparison.get("face", 0.5),
                lip_sync=comparison.get("sync", 0.5),
                speech_patterns=comparison.get("speech", 0.5)
            )

            result = VerifyResponse(
                authentic=authentic,
                confidence=confidence,
                breakdown=breakdown,
                anomalies=anomalies,
                analysis_details={
                    "voice_samples_compared": test_features.get("voice_count", 0),
                    "face_samples_compared": test_features.get("face_count", 0),
                    "profile_strength": profile.get("strength", 0),
                    "test_duration": test_features.get("duration", 0)
                }
            )

            # Store verification result
            await db.store_verification(
                verification_id=str(uuid.uuid4()),
                user_id=user_id,
                result={
                    "authentic": authentic,
                    "confidence": confidence,
                    "breakdown": breakdown.model_dump(),
                    "anomalies": anomalies
                },
                file_hash=file_hash
            )

            return result

        finally:
            # Cleanup temp file
            if temp_path.exists():
                temp_path.unlink()

    async def _load_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Load user's enrolled profile embeddings."""
        # Get all embeddings
        voice_embeddings = await db.get_user_embeddings(user_id, EmbeddingType.VOICE)
        face_embeddings = await db.get_user_embeddings(user_id, EmbeddingType.FACE)
        sync_embeddings = await db.get_user_embeddings(user_id, EmbeddingType.SYNC)

        if not voice_embeddings and not face_embeddings:
            return None

        # Parse voice embeddings
        voice_vectors = []
        voice_mean = None
        for emb in voice_embeddings:
            vector = voice_model.bytes_to_embedding(emb.embedding_data)
            if emb.metadata and emb.metadata.get("type") == "mean":
                voice_mean = vector
            else:
                voice_vectors.append(vector)

        if voice_mean is None and voice_vectors:
            voice_mean = np.mean(voice_vectors, axis=0)

        # Parse face embeddings
        face_vectors = []
        face_mean = None
        emotions = []
        for emb in face_embeddings:
            vector = face_model.bytes_to_embedding(emb.embedding_data)
            if emb.metadata and emb.metadata.get("type") == "mean":
                face_mean = vector
            else:
                face_vectors.append(vector)
                if emb.metadata and "emotion" in emb.metadata:
                    emotions.append(emb.metadata["emotion"])

        if face_mean is None and face_vectors:
            face_mean = np.mean(face_vectors, axis=0)

        # Parse sync baseline
        sync_mean = 0.5
        sync_std = 0.1
        for emb in sync_embeddings:
            if emb.metadata and emb.metadata.get("type") == "baseline":
                data = np.frombuffer(emb.embedding_data, dtype=np.float32)
                if len(data) >= 2:
                    sync_mean, sync_std = data[0], data[1]
                break

        # Calculate profile strength
        strength = min(1.0, (len(voice_vectors) / 20 + len(face_vectors) / 30) / 2)

        return {
            "voice_mean": voice_mean,
            "voice_vectors": voice_vectors,
            "face_mean": face_mean,
            "face_vectors": face_vectors,
            "emotions": emotions,
            "sync_mean": sync_mean,
            "sync_std": sync_std,
            "strength": strength
        }

    async def _extract_test_features(self, video_path: Path) -> Dict[str, Any]:
        """Extract features from test video for comparison."""
        # Read file and process
        with open(video_path, "rb") as f:
            video_data = f.read()

        import base64
        base64_video = base64.b64encode(video_data).decode()

        audio, sample_rate, frames = media_processor.process_video_chunk(base64_video)

        # Extract voice embeddings
        speech_segments = media_processor.detect_voice_activity(audio, sample_rate)
        voice_embs = voice_model.extract_embeddings_from_segments(
            audio, sample_rate, speech_segments
        )
        voice_vectors = [emb for emb, _ in voice_embs]

        # Extract face embeddings
        face_results = face_model.extract_embeddings_from_frames(frames, analyze_emotion=True)
        face_vectors = [f["embedding"] for f in face_results]
        emotions = [f.get("emotion", "unknown") for f in face_results]

        # Compute sync score
        sync_score, sync_scores = sync_model.analyze_sync(frames, audio, sample_rate)

        # Calculate speech duration
        speech_duration = sum(end - start for start, end in speech_segments)

        return {
            "voice_vectors": voice_vectors,
            "voice_mean": np.mean(voice_vectors, axis=0) if voice_vectors else None,
            "voice_count": len(voice_vectors),
            "face_vectors": face_vectors,
            "face_mean": np.mean(face_vectors, axis=0) if face_vectors else None,
            "face_count": len(face_vectors),
            "emotions": emotions,
            "sync_score": sync_score,
            "sync_scores": sync_scores,
            "speech_duration": speech_duration,
            "duration": len(audio) / sample_rate if sample_rate > 0 else 0
        }

    def _compare_to_profile(
        self, test: Dict[str, Any], profile: Dict[str, Any]
    ) -> Dict[str, float]:
        """Compare test features against profile."""
        comparison = {}

        # Voice comparison
        if test.get("voice_mean") is not None and profile.get("voice_mean") is not None:
            mean_sim, min_sim = voice_model.compute_profile_similarity(
                test["voice_mean"],
                profile.get("voice_vectors", []),
                profile["voice_mean"]
            )
            comparison["voice"] = mean_sim
            comparison["voice_min"] = min_sim
        else:
            comparison["voice"] = 0.5  # Neutral if no data

        # Face comparison
        if test.get("face_mean") is not None and profile.get("face_mean") is not None:
            mean_sim, max_sim, min_sim = face_model.compute_profile_similarity(
                test["face_mean"],
                profile.get("face_vectors", []),
                profile["face_mean"]
            )
            comparison["face"] = mean_sim
            comparison["face_max"] = max_sim
            comparison["face_min"] = min_sim
        else:
            comparison["face"] = 0.5

        # Sync comparison
        if test.get("sync_score") is not None:
            profile_sync_mean = profile.get("sync_mean", 0.5)
            profile_sync_std = profile.get("sync_std", 0.1)

            # Score based on how close to baseline
            diff = abs(test["sync_score"] - profile_sync_mean)
            # Convert to similarity (smaller diff = higher score)
            sync_sim = max(0, 1 - diff / 0.5)
            comparison["sync"] = sync_sim
            comparison["sync_raw"] = test["sync_score"]
        else:
            comparison["sync"] = 0.5

        # Speech patterns (simplified - just check if speech was detected)
        if test.get("speech_duration", 0) > 0:
            comparison["speech"] = 0.7  # Baseline score if speech detected
        else:
            comparison["speech"] = 0.3

        return comparison

    def _calculate_confidence(self, comparison: Dict[str, float]) -> float:
        """Calculate overall confidence score."""
        confidence = (
            comparison.get("voice", 0.5) * VOICE_WEIGHT +
            comparison.get("face", 0.5) * FACE_WEIGHT +
            comparison.get("sync", 0.5) * SYNC_WEIGHT +
            comparison.get("speech", 0.5) * SPEECH_WEIGHT
        )
        return float(np.clip(confidence, 0, 1))

    def _detect_anomalies(
        self,
        test: Dict[str, Any],
        profile: Dict[str, Any],
        comparison: Dict[str, float]
    ) -> List[str]:
        """Detect specific anomalies that suggest synthetic content."""
        anomalies = []

        # Check for voice/face mismatch
        voice_score = comparison.get("voice", 0.5)
        face_score = comparison.get("face", 0.5)

        if abs(voice_score - face_score) > 0.3:
            if voice_score > face_score:
                anomalies.append(
                    f"Voice matches profile ({voice_score:.0%}) but face diverges ({face_score:.0%})"
                )
            else:
                anomalies.append(
                    f"Face matches profile ({face_score:.0%}) but voice diverges ({voice_score:.0%})"
                )

        # Check lip sync anomaly
        if test.get("sync_score") is not None:
            is_anomalous, desc = sync_model.check_sync_anomaly(
                test["sync_score"],
                profile.get("sync_mean", 0.5),
                profile.get("sync_std", 0.1),
                SYNC_STD_DEV_THRESHOLD
            )
            if is_anomalous:
                anomalies.append(desc)

        # Check for unusual expression range
        if test.get("emotions") and profile.get("emotions"):
            is_ok, new_expressions = face_model.check_expression_range(
                test["emotions"], profile["emotions"]
            )
            if not is_ok and new_expressions:
                anomalies.append(
                    f"Expressions not seen in enrollment: {', '.join(new_expressions)}"
                )

        # Check for very low individual scores
        if comparison.get("voice", 1.0) < 0.4:
            anomalies.append(f"Voice similarity unusually low ({comparison['voice']:.0%})")

        if comparison.get("face", 1.0) < 0.4:
            anomalies.append(f"Face similarity unusually low ({comparison['face']:.0%})")

        # Check for suspiciously perfect sync (might indicate synthetic)
        if comparison.get("sync_raw", 0) > 0.95:
            anomalies.append("Lip sync unusually perfect (may indicate synthetic generation)")

        return anomalies

    async def get_verification_history(
        self, user_id: str, limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent verification history for a user."""
        verifications = await db.get_user_verifications(user_id, limit)

        return [
            {
                "id": v.id,
                "verified_at": v.verified_at.isoformat(),
                "authentic": v.result.get("authentic", False),
                "confidence": v.result.get("confidence", 0)
            }
            for v in verifications
        ]


# Global instance
verification_service = VerificationService()
