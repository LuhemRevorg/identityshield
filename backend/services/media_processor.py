"""Media processing service for extracting audio and frames from video."""
import base64
import tempfile
import subprocess
import os
from pathlib import Path
from typing import List, Tuple, Optional
import numpy as np
import cv2
from pydub import AudioSegment
import logging

from config import AUDIO_SAMPLE_RATE, FRAME_EXTRACTION_FPS

logger = logging.getLogger(__name__)


class MediaProcessor:
    """Handles extraction of audio and video frames from video chunks."""

    def __init__(self):
        self.temp_dir = Path(tempfile.gettempdir()) / "identityshield"
        self.temp_dir.mkdir(exist_ok=True)

    def decode_video_chunk(self, base64_data: str) -> bytes:
        """Decode base64 video data."""
        # Handle data URL prefix if present
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
        return base64.b64decode(base64_data)

    def save_temp_video(self, video_data: bytes, filename: str = None) -> Path:
        """Save video data to temporary file."""
        if filename is None:
            filename = f"video_{os.urandom(8).hex()}.webm"
        filepath = self.temp_dir / filename
        filepath.write_bytes(video_data)
        return filepath

    def extract_audio(self, video_path: Path) -> Tuple[np.ndarray, int]:
        """
        Extract audio from video file and return as numpy array.

        Returns:
            Tuple of (audio_samples, sample_rate)
        """
        audio_path = video_path.with_suffix(".wav")

        try:
            # Use FFmpeg to extract audio
            cmd = [
                "ffmpeg", "-y", "-i", str(video_path),
                "-vn",  # No video
                "-acodec", "pcm_s16le",  # PCM 16-bit
                "-ar", str(AUDIO_SAMPLE_RATE),  # Sample rate
                "-ac", "1",  # Mono
                str(audio_path)
            ]
            subprocess.run(cmd, capture_output=True, check=True)

            # Load audio using pydub
            audio = AudioSegment.from_wav(str(audio_path))
            samples = np.array(audio.get_array_of_samples(), dtype=np.float32)

            # Normalize to [-1, 1]
            samples = samples / 32768.0

            return samples, AUDIO_SAMPLE_RATE

        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg error: {e.stderr.decode() if e.stderr else str(e)}")
            raise RuntimeError("Failed to extract audio from video")
        finally:
            # Cleanup temp audio file
            if audio_path.exists():
                audio_path.unlink()

    def extract_frames(
        self, video_path: Path, fps: float = FRAME_EXTRACTION_FPS
    ) -> List[Tuple[np.ndarray, float]]:
        """
        Extract frames from video at specified FPS.

        Returns:
            List of (frame, timestamp) tuples
        """
        frames = []
        cap = cv2.VideoCapture(str(video_path))

        if not cap.isOpened():
            raise RuntimeError(f"Failed to open video: {video_path}")

        video_fps = cap.get(cv2.CAP_PROP_FPS)
        if video_fps <= 0:
            video_fps = 30  # Default assumption

        frame_interval = int(video_fps / fps) if fps < video_fps else 1
        frame_count = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                if frame_count % frame_interval == 0:
                    timestamp = frame_count / video_fps
                    # Convert BGR to RGB
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    frames.append((frame_rgb, timestamp))

                frame_count += 1
        finally:
            cap.release()

        return frames

    def extract_mouth_region(
        self, frame: np.ndarray, face_landmarks: Optional[dict] = None
    ) -> Optional[np.ndarray]:
        """
        Extract mouth region from frame for lip-sync analysis.

        If face_landmarks not provided, uses simple face detection.
        """
        # If we have landmarks, use them
        if face_landmarks and "mouth" in face_landmarks:
            mouth = face_landmarks["mouth"]
            x, y, w, h = mouth["x"], mouth["y"], mouth["width"], mouth["height"]
            # Add padding
            pad = int(min(w, h) * 0.2)
            x1 = max(0, x - pad)
            y1 = max(0, y - pad)
            x2 = min(frame.shape[1], x + w + pad)
            y2 = min(frame.shape[0], y + h + pad)
            return frame[y1:y2, x1:x2]

        # Fallback: use Haar cascade for face detection
        gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY)
        face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
        faces = face_cascade.detectMultiScale(gray, 1.1, 4)

        if len(faces) == 0:
            return None

        # Get largest face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])

        # Estimate mouth region (lower third of face)
        mouth_y = y + int(h * 0.6)
        mouth_h = int(h * 0.35)
        mouth_x = x + int(w * 0.2)
        mouth_w = int(w * 0.6)

        return frame[mouth_y:mouth_y+mouth_h, mouth_x:mouth_x+mouth_w]

    def detect_voice_activity(
        self, audio: np.ndarray, sample_rate: int, frame_duration_ms: int = 30
    ) -> List[Tuple[float, float]]:
        """
        Detect voice activity segments in audio.

        Returns:
            List of (start_time, end_time) tuples for speech segments
        """
        try:
            import webrtcvad
            vad = webrtcvad.Vad(2)  # Aggressiveness level 2

            # Convert to 16-bit PCM
            audio_int16 = (audio * 32767).astype(np.int16).tobytes()

            frame_size = int(sample_rate * frame_duration_ms / 1000)
            num_frames = len(audio) // frame_size

            speech_frames = []
            for i in range(num_frames):
                start = i * frame_size
                end = start + frame_size
                frame_bytes = audio_int16[start*2:end*2]

                if len(frame_bytes) == frame_size * 2:
                    try:
                        is_speech = vad.is_speech(frame_bytes, sample_rate)
                        speech_frames.append((i * frame_duration_ms / 1000, is_speech))
                    except Exception:
                        speech_frames.append((i * frame_duration_ms / 1000, False))

            # Merge consecutive speech frames into segments
            segments = []
            in_speech = False
            start_time = 0

            for time, is_speech in speech_frames:
                if is_speech and not in_speech:
                    start_time = time
                    in_speech = True
                elif not is_speech and in_speech:
                    segments.append((start_time, time))
                    in_speech = False

            if in_speech:
                segments.append((start_time, speech_frames[-1][0]))

            return segments

        except ImportError:
            # Fallback: simple energy-based VAD
            logger.warning("webrtcvad not available, using energy-based VAD")
            return self._energy_vad(audio, sample_rate)

    def _energy_vad(
        self, audio: np.ndarray, sample_rate: int, threshold: float = 0.02
    ) -> List[Tuple[float, float]]:
        """Simple energy-based voice activity detection."""
        frame_size = int(sample_rate * 0.03)  # 30ms frames
        num_frames = len(audio) // frame_size

        segments = []
        in_speech = False
        start_time = 0

        for i in range(num_frames):
            start = i * frame_size
            end = start + frame_size
            frame = audio[start:end]
            energy = np.sqrt(np.mean(frame ** 2))

            time = i * 0.03
            if energy > threshold and not in_speech:
                start_time = time
                in_speech = True
            elif energy <= threshold and in_speech:
                if time - start_time > 0.1:  # Min 100ms speech
                    segments.append((start_time, time))
                in_speech = False

        if in_speech:
            segments.append((start_time, num_frames * 0.03))

        return segments

    def process_video_chunk(
        self, base64_video: str
    ) -> Tuple[np.ndarray, int, List[Tuple[np.ndarray, float]]]:
        """
        Process a video chunk and extract audio and frames.

        Returns:
            Tuple of (audio_samples, sample_rate, frames_with_timestamps)
        """
        video_data = self.decode_video_chunk(base64_video)
        video_path = self.save_temp_video(video_data)

        try:
            audio, sample_rate = self.extract_audio(video_path)
            frames = self.extract_frames(video_path)
            return audio, sample_rate, frames
        finally:
            # Cleanup temp video file
            if video_path.exists():
                video_path.unlink()

    def cleanup(self):
        """Clean up temporary files."""
        import shutil
        if self.temp_dir.exists():
            shutil.rmtree(self.temp_dir, ignore_errors=True)
            self.temp_dir.mkdir(exist_ok=True)


# Global instance
media_processor = MediaProcessor()
