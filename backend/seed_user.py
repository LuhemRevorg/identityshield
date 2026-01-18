"""Seed a test user into the database."""
import asyncio
import uuid
import json
import hashlib
import random
from datetime import datetime, timedelta
import bcrypt
import aiosqlite
from pathlib import Path


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

DATABASE_PATH = Path(__file__).resolve().parent / "data" / "identityshield.db"

async def seed_user():
    # Ensure data directory exists
    Path("./data").mkdir(parents=True, exist_ok=True)

    # Connect to database
    conn = await aiosqlite.connect(DATABASE_PATH)
    conn.row_factory = aiosqlite.Row

    # Create tables if they don't exist
    await conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMP NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT,
        name TEXT
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enrollment_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        duration_seconds REAL,
        objectives_covered TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        session_id TEXT NOT NULL REFERENCES enrollment_sessions(id),
        embedding_type TEXT NOT NULL,
        embedding_data BLOB NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS verifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id),
        verified_at TIMESTAMP NOT NULL,
        result TEXT NOT NULL,
        file_hash TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_embeddings_user ON embeddings(user_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_type ON embeddings(embedding_type);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON enrollment_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    """)
    await conn.commit()

    # Seed user details
    email = "mehulg8142@gmail.com"
    password = "password123"
    name = "Mehul Grover"

    # Check if user already exists
    created_user = False
    async with conn.execute("SELECT * FROM users WHERE email = ?", (email,)) as cursor:
        existing = await cursor.fetchone()
        if existing:
            print(f"User with email {email} already exists (id: {existing['id']})")
            user_id = existing["id"]
        else:
            # Create user
            user_id = str(uuid.uuid4())
            password_hash = hash_password(password)
            now = datetime.utcnow()

            await conn.execute(
                "INSERT INTO users (id, created_at, email, password_hash, name) VALUES (?, ?, ?, ?, ?)",
                (user_id, now.isoformat(), email, password_hash, name)
            )
            await conn.commit()
            created_user = True

    now = datetime.utcnow()
    await conn.execute("DELETE FROM enrollment_sessions WHERE user_id = ?", (user_id,))
    await conn.commit()

    # Seed 7 completed enrollment sessions on Jan 17
    base_date = datetime.utcnow().replace(month=1, day=17, hour=9, minute=0, second=0, microsecond=0)
    for index in range(7):
        session_id = str(uuid.uuid4())
        start_time = base_date + timedelta(hours=random.randint(0, 10), minutes=random.randint(0, 59))
        duration_seconds = random.randint(180, 480)
        completed_at = start_time + timedelta(seconds=duration_seconds)
        objectives = ["voice", "face", "sync"]

        await conn.execute(
            """INSERT INTO enrollment_sessions
               (id, user_id, started_at, completed_at, duration_seconds, objectives_covered)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                session_id,
                user_id,
                start_time.isoformat(),
                completed_at.isoformat(),
                float(duration_seconds),
                json.dumps(objectives),
            )
        )
    await conn.commit()

    # Seed verification history for provided assets
    await conn.execute("DELETE FROM verifications WHERE user_id = ?", (user_id,))
    await conn.commit()

    assets_dir = Path(__file__).resolve().parent / "assets"
    assets = [
        (assets_dir / "Real_mario.mov", "Real_mario.mov", True, 0.94),
        (assets_dir / "Deepfake_dolphin.mp4", "Deepfake_dolphin.mp4", False, 0.12),
    ]
    verify_base = base_date.replace(hour=15, minute=10)

    for offset, (asset_path, file_name, authentic, confidence) in enumerate(assets):
        file_bytes = asset_path.read_bytes()
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        verified_at = verify_base + timedelta(minutes=offset * 22)
        result = {
            "authentic": authentic,
            "confidence": confidence,
            "file_name": file_name,
            "file_url": f"/assets/{file_name}",
            "breakdown": {
                "voice_match": confidence,
                "face_match": confidence,
                "lip_sync": confidence,
                "speech_patterns": confidence,
            },
            "anomalies": ["Synthetic patterns detected"] if not authentic else [],
        }

        await conn.execute(
            "INSERT INTO verifications (id, user_id, verified_at, result, file_hash) VALUES (?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), user_id, verified_at.isoformat(), json.dumps(result), file_hash)
        )
    await conn.commit()
    await conn.close()

    print(f"{'Created' if created_user else 'Updated'} seed user:")
    print(f"  Email: {email}")
    print(f"  Password: {password}")
    print(f"  Name: {name}")
    print(f"  User ID: {user_id}")

if __name__ == "__main__":
    asyncio.run(seed_user())
