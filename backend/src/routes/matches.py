"""
Match recording and history for the game simulator.

POST /me/matches  — record a completed game (called by frontend when game ends)
GET  /me/matches  — paginated match history for the current user
GET  /me/stats    — aggregated win/loss/draw counts and win rate
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
import datetime
import uuid
import logging

from src.database.db import get_app_db
from src.database.models import User, Match
from src.auth.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MatchCreate(BaseModel):
    opponent_type: str          # 'cpu' | 'human'
    result: str                 # 'win' | 'loss' | 'draw'
    deck_id: Optional[str] = None
    leader1_name: Optional[str] = None
    leader2_name: Optional[str] = None
    turns: Optional[int] = None
    difficulty: Optional[str] = None   # 'easy' | 'normal' (cpu)
    match_type: str = 'casual'


class MatchOut(BaseModel):
    id: str
    opponent_type: str
    result: str
    deck_id: Optional[str]
    leader1_name: Optional[str]
    leader2_name: Optional[str]
    turns: Optional[int]
    difficulty: Optional[str]
    match_type: str
    created_at: str

    class Config:
        orm_mode = True


class StatsOut(BaseModel):
    games_played: int
    wins: int
    losses: int
    draws: int
    win_rate: float
    cpu_games: int
    cpu_wins: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_and_award_game_achievements(user_id: str, db: Session) -> None:
    """Insert any newly earned game achievements. Silently no-ops on failure."""
    try:
        total_games = db.execute(
            text("SELECT COUNT(*) FROM matches WHERE player_id = :uid"),
            {"uid": user_id},
        ).scalar() or 0

        total_wins = db.execute(
            text("SELECT COUNT(*) FROM matches WHERE player_id = :uid AND result = 'win'"),
            {"uid": user_id},
        ).scalar() or 0

        cpu_normal_wins = db.execute(
            text("""
                SELECT COUNT(*) FROM matches
                WHERE player_id = :uid AND result = 'win'
                  AND opponent_type = 'cpu' AND difficulty = 'normal'
            """),
            {"uid": user_id},
        ).scalar() or 0

        earned_rows = db.execute(
            text("SELECT key FROM user_achievements WHERE user_id = :uid"),
            {"uid": user_id},
        ).fetchall()
        already_earned = {r[0] for r in earned_rows}

        candidates = {
            "first_game":    total_games >= 1,
            "first_win":     total_wins >= 1,
            "ten_wins":      total_wins >= 10,
            "cpu_crusher":   cpu_normal_wins >= 1,
        }

        now = datetime.datetime.utcnow()
        for key, met in candidates.items():
            if met and key not in already_earned:
                db.execute(
                    text("""
                        INSERT OR IGNORE INTO user_achievements (id, user_id, key, earned_at, source)
                        VALUES (:id, :uid, :key, :now, NULL)
                    """),
                    {"id": str(uuid.uuid4()), "uid": user_id, "key": key, "now": now},
                )
        db.commit()
    except Exception as e:
        logger.error(f"Achievement check failed for user {user_id}: {e}", exc_info=True)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/matches", status_code=201)
async def record_match(
    payload: MatchCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_app_db),
):
    if payload.opponent_type not in ("cpu", "human"):
        raise HTTPException(status_code=422, detail="opponent_type must be 'cpu' or 'human'")
    if payload.result not in ("win", "loss", "draw"):
        raise HTTPException(status_code=422, detail="result must be 'win', 'loss', or 'draw'")

    match = Match(
        id=str(uuid.uuid4()),
        player_id=current_user.id,
        opponent_type=payload.opponent_type,
        result=payload.result,
        deck_id=payload.deck_id,
        leader1_name=payload.leader1_name,
        leader2_name=payload.leader2_name,
        turns=payload.turns,
        difficulty=payload.difficulty,
        match_type=payload.match_type,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(match)
    db.commit()
    db.refresh(match)

    _check_and_award_game_achievements(current_user.id, db)

    return {"id": match.id, "created_at": match.created_at.isoformat()}


@router.get("/matches", response_model=List[MatchOut])
async def list_matches(
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_app_db),
):
    rows = db.execute(
        text("""
            SELECT id, opponent_type, result, deck_id, leader1_name, leader2_name,
                   turns, difficulty, match_type, created_at
            FROM matches
            WHERE player_id = :uid
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {"uid": current_user.id, "limit": limit, "offset": offset},
    ).fetchall()

    return [
        {
            "id": r[0],
            "opponent_type": r[1],
            "result": r[2],
            "deck_id": r[3],
            "leader1_name": r[4],
            "leader2_name": r[5],
            "turns": r[6],
            "difficulty": r[7],
            "match_type": r[8],
            "created_at": r[9].isoformat() if hasattr(r[9], "isoformat") else str(r[9]),
        }
        for r in rows
    ]


@router.get("/stats", response_model=StatsOut)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_app_db),
):
    row = db.execute(
        text("""
            SELECT
                COUNT(*)                                            AS games_played,
                SUM(CASE WHEN result = 'win'  THEN 1 ELSE 0 END)  AS wins,
                SUM(CASE WHEN result = 'loss' THEN 1 ELSE 0 END)  AS losses,
                SUM(CASE WHEN result = 'draw' THEN 1 ELSE 0 END)  AS draws,
                SUM(CASE WHEN opponent_type = 'cpu' THEN 1 ELSE 0 END) AS cpu_games,
                SUM(CASE WHEN opponent_type = 'cpu' AND result = 'win' THEN 1 ELSE 0 END) AS cpu_wins
            FROM matches
            WHERE player_id = :uid
        """),
        {"uid": current_user.id},
    ).fetchone()

    games  = row[0] or 0
    wins   = row[1] or 0
    losses = row[2] or 0
    draws  = row[3] or 0
    cpu_games = row[4] or 0
    cpu_wins  = row[5] or 0

    return {
        "games_played": games,
        "wins": wins,
        "losses": losses,
        "draws": draws,
        "win_rate": round(wins / games, 3) if games > 0 else 0.0,
        "cpu_games": cpu_games,
        "cpu_wins": cpu_wins,
    }
