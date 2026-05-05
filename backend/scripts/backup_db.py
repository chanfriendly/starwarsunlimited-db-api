#!/usr/bin/env python3
# backup_db.py — Back up both SQLite databases with integrity check.
# Keeps the last 5 backups per database.
#
# Respects DB_DIR env var (same as the rest of the stack).
# Individual paths can be overridden with CARD_DATABASE_PATH and DATABASE_PATH.
# Backup destination can be overridden with BACKUP_DIR.

import os
import sqlite3
import shutil
import datetime
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='db_backup.log'
)
logger = logging.getLogger(__name__)


def backup_database(db_path, backup_dir):
    """Backup a SQLite database file with integrity check. Returns True on success."""
    try:
        db_path = Path(db_path)
        if not db_path.exists():
            logger.error(f"Database file not found: {db_path}")
            return False

        backup_path = Path(backup_dir)
        backup_path.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = backup_path / f"{db_path.stem}_{timestamp}.db"

        conn = sqlite3.connect(db_path)
        integrity_check = conn.execute("PRAGMA integrity_check").fetchone()[0]
        conn.close()

        if integrity_check != "ok":
            logger.error(f"Integrity check failed for {db_path}: {integrity_check}")
            return False

        shutil.copy2(db_path, backup_file)
        logger.info(f"Backed up {db_path} -> {backup_file}")

        # Prune old backups — keep last 5
        backups = sorted(backup_path.glob(f"{db_path.stem}_*.db"))
        for old in backups[:-5]:
            old.unlink()
            logger.info(f"Removed old backup: {old}")

        return True

    except Exception as e:
        logger.error(f"Error backing up {db_path}: {e}")
        return False


if __name__ == "__main__":
    db_dir = os.environ.get("DB_DIR", os.path.join(os.path.expanduser("~"), ".swu"))

    card_db = os.environ.get("CARD_DATABASE_PATH", os.path.join(db_dir, "swu_cards.db"))
    app_db = os.environ.get("DATABASE_PATH", os.path.join(db_dir, "swu_app.db"))
    backup_dir = os.environ.get("BACKUP_DIR", os.path.join(db_dir, "backups"))

    card_ok = backup_database(card_db, backup_dir)
    app_ok = backup_database(app_db, backup_dir)

    if card_ok and app_ok:
        print("All database backups completed successfully")
        raise SystemExit(0)
    else:
        print("One or more backups failed — see db_backup.log for details")
        raise SystemExit(1)
