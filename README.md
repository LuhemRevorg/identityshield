# IdentityShield

A personal deepfake detection system that learns your unique identity through natural video conversations with an AI, then uses that learned profile to verify whether video/audio content is authentic or synthetic.

## Features

- **Natural Enrollment**: Have a 5-7 minute conversation with an AI assistant while the system passively captures your voice, facial expressions, and speaking patterns
- **Identity Fingerprint**: Builds a unique profile using voice embeddings, face embeddings, and lip-sync analysis
- **Content Verification**: Upload suspicious video/audio content to check if it's really you or a deepfake
- **Detailed Analysis**: Get confidence scores and specific anomaly detection for voice, face, lip-sync, and speech patterns

## Architecture

```
identityshield/
├── frontend/                 # React + Vite frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── hooks/            # Custom React hooks
│   │   └── services/         # API client
│   └── package.json
├── backend/                  # Python FastAPI backend
│   ├── services/             # Business logic
│   ├── models/               # ML model wrappers
│   ├── database/             # SQLite + schemas
│   └── main.py               # API routes
└── README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- FFmpeg (for video/audio processing)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

## Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create environment file:
```bash
cp .env.example .env
```

5. Edit `.env` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

6. Start the backend server:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open http://localhost:5173 in your browser

## Usage

### Enrollment Flow

1. Click "Start Enrollment" on the landing page
2. Grant camera and microphone permissions
3. Have a natural conversation with the AI (5-7 minutes)
4. The system captures your voice, face, and expressions in the background
5. Click "Complete Enrollment" when done

### Verification Flow

1. From the dashboard, click "Verify Content"
2. Upload a video or audio file
3. Wait for analysis to complete
4. Review the authenticity verdict and confidence breakdown

## API Endpoints

### Enrollment

- `POST /api/enrollment/start` - Start new enrollment session
- `POST /api/enrollment/chunk` - Upload video chunk during enrollment
- `POST /api/enrollment/complete` - Complete enrollment session

### Profile

- `GET /api/profile/{user_id}` - Get user profile strength

### Conversation

- `POST /api/conversation/message` - Send message to AI conversation

### Verification

- `POST /api/verify` - Verify uploaded content
- `GET /api/verify/history/{user_id}` - Get verification history

## Technology Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Framer Motion
- Axios
- react-dropzone

### Backend
- FastAPI
- SQLite (via aiosqlite)
- Anthropic Claude API
- Resemblyzer (voice embeddings)
- DeepFace (face embeddings)
- OpenCV
- FFmpeg

## How It Works

### Voice Analysis
- Extracts speaker embeddings using Resemblyzer
- Samples at 16kHz, extracts embeddings every 3-5 seconds of speech
- Uses voice activity detection to skip silence
- Compares using cosine similarity

### Face Analysis
- Extracts facial embeddings using DeepFace (VGG-Face model)
- Extracts frames at 2 FPS during speech
- Tracks expression variation (neutral, smile, surprise, etc.)
- Compares embeddings and checks expression range

### Lip-Sync Analysis
- Correlates mouth movement with audio energy
- Establishes baseline sync characteristics during enrollment
- Detects sync anomalies that may indicate manipulation

### Verification Logic

When verifying content:
1. Extract same features from uploaded video
2. Compare each feature type to stored profile:
   - Voice: 30% weight
   - Face: 25% weight
   - Lip-sync: 25% weight
   - Speech patterns: 20% weight
3. Flag specific anomalies
4. Return confidence score and breakdown

## Limitations

- Requires good lighting for face detection
- Minimum 1 minute of enrollment data for basic profile
- Voice analysis works best with clear audio
- Currently single-user focused (no multi-user auth)

## Privacy

- Embeddings are not reversible to original video/audio
- Raw video data is processed and discarded
- All data stored locally in SQLite database
- No data sent to external services (except Claude API for conversation)

## License

MIT
