"""Seed a test user into the database."""
import asyncio
import uuid
from datetime import datetime
import bcrypt
import aiosqlite
from pathlib import Path


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

DATABASE_PATH = "./data/identityshield.db"

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
    async with conn.execute("SELECT * FROM users WHERE email = ?", (email,)) as cursor:
        existing = await cursor.fetchone()
        if existing:
            print(f"User with email {email} already exists (id: {existing['id']})")
            await conn.close()
            return

    # Create user
    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)
    now = datetime.utcnow()

    await conn.execute(
        "INSERT INTO users (id, created_at, email, password_hash, name) VALUES (?, ?, ?, ?, ?)",
        (user_id, now.isoformat(), email, password_hash, name)
    )
    await conn.commit()
    await conn.close()

    print(f"Created seed user:")
    print(f"  Email: {email}")
    print(f"  Password: {password}")
    print(f"  Name: {name}")
    print(f"  User ID: {user_id}")

if __name__ == "__main__":
    asyncio.run(seed_user())
