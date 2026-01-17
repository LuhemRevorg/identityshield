"""SQLite database setup and operations."""
import aiosqlite
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from pathlib import Path

from config import DATABASE_PATH
from database.schemas import (
    UserDB, EnrollmentSessionDB, EmbeddingDB, VerificationDB, EmbeddingType
)

# SQL schema
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    email TEXT
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
"""


class Database:
    def __init__(self, db_path: str = DATABASE_PATH):
        self.db_path = db_path
        self._connection: Optional[aiosqlite.Connection] = None

    async def connect(self):
        """Initialize database connection and create tables."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self._connection = await aiosqlite.connect(self.db_path)
        self._connection.row_factory = aiosqlite.Row
        await self._connection.executescript(SCHEMA)
        await self._connection.commit()

    async def close(self):
        """Close database connection."""
        if self._connection:
            await self._connection.close()
            self._connection = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")
        return self._connection

    # User operations
    async def create_user(self, user_id: str, email: Optional[str] = None) -> UserDB:
        """Create a new user."""
        now = datetime.utcnow()
        await self.conn.execute(
            "INSERT INTO users (id, created_at, email) VALUES (?, ?, ?)",
            (user_id, now.isoformat(), email)
        )
        await self.conn.commit()
        return UserDB(id=user_id, created_at=now, email=email)

    async def get_user(self, user_id: str) -> Optional[UserDB]:
        """Get user by ID."""
        async with self.conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return UserDB(
                    id=row["id"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                    email=row["email"]
                )
        return None

    async def get_or_create_user(self, user_id: str, email: Optional[str] = None) -> UserDB:
        """Get existing user or create new one."""
        user = await self.get_user(user_id)
        if user:
            return user
        return await self.create_user(user_id, email)

    # Enrollment session operations
    async def create_session(self, session_id: str, user_id: str) -> EnrollmentSessionDB:
        """Create a new enrollment session."""
        now = datetime.utcnow()
        await self.conn.execute(
            """INSERT INTO enrollment_sessions
               (id, user_id, started_at, objectives_covered)
               VALUES (?, ?, ?, ?)""",
            (session_id, user_id, now.isoformat(), "[]")
        )
        await self.conn.commit()
        return EnrollmentSessionDB(
            id=session_id, user_id=user_id, started_at=now, objectives_covered=[]
        )

    async def get_session(self, session_id: str) -> Optional[EnrollmentSessionDB]:
        """Get enrollment session by ID."""
        async with self.conn.execute(
            "SELECT * FROM enrollment_sessions WHERE id = ?", (session_id,)
        ) as cursor:
            row = await cursor.fetchone()
            if row:
                return EnrollmentSessionDB(
                    id=row["id"],
                    user_id=row["user_id"],
                    started_at=datetime.fromisoformat(row["started_at"]),
                    completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
                    duration_seconds=row["duration_seconds"],
                    objectives_covered=json.loads(row["objectives_covered"])
                )
        return None

    async def complete_session(
        self, session_id: str, duration_seconds: float, objectives_covered: List[str]
    ):
        """Mark session as complete."""
        now = datetime.utcnow()
        await self.conn.execute(
            """UPDATE enrollment_sessions
               SET completed_at = ?, duration_seconds = ?, objectives_covered = ?
               WHERE id = ?""",
            (now.isoformat(), duration_seconds, json.dumps(objectives_covered), session_id)
        )
        await self.conn.commit()

    async def get_user_sessions(self, user_id: str) -> List[EnrollmentSessionDB]:
        """Get all sessions for a user."""
        sessions = []
        async with self.conn.execute(
            "SELECT * FROM enrollment_sessions WHERE user_id = ? ORDER BY started_at DESC",
            (user_id,)
        ) as cursor:
            async for row in cursor:
                sessions.append(EnrollmentSessionDB(
                    id=row["id"],
                    user_id=row["user_id"],
                    started_at=datetime.fromisoformat(row["started_at"]),
                    completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
                    duration_seconds=row["duration_seconds"],
                    objectives_covered=json.loads(row["objectives_covered"])
                ))
        return sessions

    # Embedding operations
    async def store_embedding(
        self,
        embedding_id: str,
        user_id: str,
        session_id: str,
        embedding_type: EmbeddingType,
        embedding_data: bytes,
        metadata: Optional[Dict[str, Any]] = None
    ) -> EmbeddingDB:
        """Store an embedding."""
        now = datetime.utcnow()
        await self.conn.execute(
            """INSERT INTO embeddings
               (id, user_id, session_id, embedding_type, embedding_data, timestamp, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                embedding_id, user_id, session_id, embedding_type.value,
                embedding_data, now.isoformat(),
                json.dumps(metadata) if metadata else None
            )
        )
        await self.conn.commit()
        return EmbeddingDB(
            id=embedding_id, user_id=user_id, session_id=session_id,
            embedding_type=embedding_type, embedding_data=embedding_data,
            timestamp=now, metadata=metadata
        )

    async def get_user_embeddings(
        self, user_id: str, embedding_type: Optional[EmbeddingType] = None
    ) -> List[EmbeddingDB]:
        """Get all embeddings for a user, optionally filtered by type."""
        embeddings = []
        query = "SELECT * FROM embeddings WHERE user_id = ?"
        params = [user_id]

        if embedding_type:
            query += " AND embedding_type = ?"
            params.append(embedding_type.value)

        query += " ORDER BY timestamp"

        async with self.conn.execute(query, params) as cursor:
            async for row in cursor:
                embeddings.append(EmbeddingDB(
                    id=row["id"],
                    user_id=row["user_id"],
                    session_id=row["session_id"],
                    embedding_type=EmbeddingType(row["embedding_type"]),
                    embedding_data=row["embedding_data"],
                    timestamp=datetime.fromisoformat(row["timestamp"]),
                    metadata=json.loads(row["metadata"]) if row["metadata"] else None
                ))
        return embeddings

    async def get_embedding_counts(self, user_id: str) -> Dict[str, int]:
        """Get count of embeddings by type for a user."""
        counts = {}
        async with self.conn.execute(
            """SELECT embedding_type, COUNT(*) as count
               FROM embeddings WHERE user_id = ? GROUP BY embedding_type""",
            (user_id,)
        ) as cursor:
            async for row in cursor:
                counts[row["embedding_type"]] = row["count"]
        return counts

    # Verification operations
    async def store_verification(
        self, verification_id: str, user_id: str, result: Dict[str, Any], file_hash: str
    ) -> VerificationDB:
        """Store a verification result."""
        now = datetime.utcnow()
        await self.conn.execute(
            "INSERT INTO verifications (id, user_id, verified_at, result, file_hash) VALUES (?, ?, ?, ?, ?)",
            (verification_id, user_id, now.isoformat(), json.dumps(result), file_hash)
        )
        await self.conn.commit()
        return VerificationDB(
            id=verification_id, user_id=user_id, verified_at=now,
            result=result, file_hash=file_hash
        )

    async def get_user_verifications(self, user_id: str, limit: int = 10) -> List[VerificationDB]:
        """Get recent verifications for a user."""
        verifications = []
        async with self.conn.execute(
            """SELECT * FROM verifications WHERE user_id = ?
               ORDER BY verified_at DESC LIMIT ?""",
            (user_id, limit)
        ) as cursor:
            async for row in cursor:
                verifications.append(VerificationDB(
                    id=row["id"],
                    user_id=row["user_id"],
                    verified_at=datetime.fromisoformat(row["verified_at"]),
                    result=json.loads(row["result"]),
                    file_hash=row["file_hash"]
                ))
        return verifications


# Global database instance
db = Database()
