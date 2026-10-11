"""Small SQLite persistence layer for session-scoped product data."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any, Iterable


DATABASE_PATH = Path(__file__).with_name("spendshield.db")


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    with _connect() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                transaction_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                UNIQUE(session_id, transaction_id)
            );
            CREATE TABLE IF NOT EXISTS locked_paths (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                path_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                UNIQUE(session_id, path_id)
            );
            CREATE INDEX IF NOT EXISTS idx_transactions_session
                ON transactions(session_id);
            CREATE INDEX IF NOT EXISTS idx_locked_paths_session
                ON locked_paths(session_id);
            CREATE TABLE IF NOT EXISTS aa_mock_consents (
                consent_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                payload TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_aa_mock_consents_session
                ON aa_mock_consents(session_id);
            """
        )


def store_transactions(session_id: str, transactions: Iterable[dict[str, Any]]) -> None:
    rows = [
        (session_id, transaction["id"], json.dumps(transaction, separators=(",", ":")))
        for transaction in transactions
    ]
    if not rows:
        return
    with _connect() as connection:
        connection.executemany(
            """
            INSERT INTO transactions(session_id, transaction_id, payload)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id, transaction_id) DO UPDATE SET payload = excluded.payload
            """,
            rows,
        )


def store_locked_path(session_id: str, locked_path: dict[str, Any]) -> None:
    with _connect() as connection:
        connection.execute(
            """
            INSERT INTO locked_paths(session_id, path_id, payload)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id, path_id) DO UPDATE SET payload = excluded.payload
            """,
            (session_id, locked_path["id"], json.dumps(locked_path, separators=(",", ":"))),
        )


def get_transactions(session_id: str) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            "SELECT payload FROM transactions WHERE session_id = ? ORDER BY id", (session_id,)
        ).fetchall()
    return [json.loads(row["payload"]) for row in rows]


def get_locked_paths(session_id: str) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            "SELECT payload FROM locked_paths WHERE session_id = ? ORDER BY id", (session_id,)
        ).fetchall()
    return [json.loads(row["payload"]) for row in rows]


def get_locked_path(session_id: str, path_id: str) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            "SELECT payload FROM locked_paths WHERE session_id = ? AND path_id = ?",
            (session_id, path_id),
        ).fetchone()
    return json.loads(row["payload"]) if row else None


def clear_user_data(session_id: str) -> dict[str, int]:
    with _connect() as connection:
        transaction_count = connection.execute(
            "DELETE FROM transactions WHERE session_id = ?", (session_id,)
        ).rowcount
        locked_path_count = connection.execute(
            "DELETE FROM locked_paths WHERE session_id = ?", (session_id,)
        ).rowcount
        connection.execute("DELETE FROM aa_mock_consents WHERE session_id = ?", (session_id,))
    # Keep the pre-existing deletion response shape stable; mock-consent rows
    # are removed as part of clearing the session's data.
    return {"transactions": transaction_count, "locked_paths": locked_path_count}


def save_aa_consent(consent: dict[str, Any]) -> None:
    with _connect() as connection:
        connection.execute(
            "INSERT INTO aa_mock_consents(consent_id, session_id, payload) VALUES (?, ?, ?)",
            (consent["consent_id"], consent["session_id"], json.dumps(consent, separators=(",", ":"))),
        )


def update_aa_consent(session_id: str, consent: dict[str, Any]) -> None:
    with _connect() as connection:
        cursor = connection.execute(
            "UPDATE aa_mock_consents SET payload = ? WHERE session_id = ? AND consent_id = ?",
            (json.dumps(consent, separators=(",", ":")), session_id, consent["consent_id"]),
        )
        if cursor.rowcount != 1:
            raise ValueError("Mock consent could not be updated for this session")


def approve_aa_consent(
    session_id: str, consent: dict[str, Any], transactions: Iterable[dict[str, Any]]
) -> None:
    """Atomically persist approved fixture rows and the approved consent state."""
    rows = [
        (session_id, transaction["id"], json.dumps(transaction, separators=(",", ":")))
        for transaction in transactions
    ]
    with _connect() as connection:
        connection.executemany(
            """
            INSERT INTO transactions(session_id, transaction_id, payload)
            VALUES (?, ?, ?)
            ON CONFLICT(session_id, transaction_id) DO UPDATE SET payload = excluded.payload
            """,
            rows,
        )
        cursor = connection.execute(
            "UPDATE aa_mock_consents SET payload = ? WHERE session_id = ? AND consent_id = ?",
            (json.dumps(consent, separators=(",", ":")), session_id, consent["consent_id"]),
        )
        if cursor.rowcount != 1:
            raise ValueError("Mock consent could not be approved for this session")


def get_aa_consent(session_id: str, consent_id: str) -> dict[str, Any] | None:
    with _connect() as connection:
        row = connection.execute(
            "SELECT payload FROM aa_mock_consents WHERE session_id = ? AND consent_id = ?",
            (session_id, consent_id),
        ).fetchone()
    return json.loads(row["payload"]) if row else None


def list_aa_consents(session_id: str) -> list[dict[str, Any]]:
    with _connect() as connection:
        rows = connection.execute(
            "SELECT payload FROM aa_mock_consents WHERE session_id = ? ORDER BY rowid DESC",
            (session_id,),
        ).fetchall()
    return [json.loads(row["payload"]) for row in rows]
