"""
Achievement definitions and the /me/achievements endpoint.

Achievement conditions are computed on-demand from existing user data every time
the endpoint is called. Newly earned achievements are inserted into user_achievements
(UNIQUE constraint prevents duplicates). This means the earned_at timestamp reflects
when the user first called the endpoint after meeting the condition, not the exact
moment they triggered it — acceptable for this scale of app.

Karabast future hook: the `source` field on user_achievements rows is the extension
point. A future POST /me/achievements/external endpoint can insert rows with
source='karabast'. No schema change required.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import Optional
import datetime
import uuid
import logging

from src.database.db import get_app_db, get_card_db
from src.database.models import User, Deck, DeckCard, UserCollection, UserWishlist
from src.auth.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Achievement catalog — hardcoded; no DB table needed for definitions
# ---------------------------------------------------------------------------

ACHIEVEMENTS = [
    # Deck building
    {"key": "first_deck",         "title": "First Flight",      "desc": "Build your first deck.",               "icon": "🚀", "category": "decks",      "points": 10},
    {"key": "three_decks",        "title": "Wing Formation",    "desc": "Save three decks.",                    "icon": "✦",  "category": "decks",      "points": 20},
    {"key": "ten_decks",          "title": "Squadron Leader",   "desc": "Save ten decks.",                      "icon": "⬡",  "category": "decks",      "points": 50},
    {"key": "all_aspects",        "title": "Full Spectrum",     "desc": "Build decks that collectively cover all 6 aspects.", "icon": "◈", "category": "decks", "points": 40},
    {"key": "first_share",        "title": "Broadcast",         "desc": "Share a deck publicly.",               "icon": "📡", "category": "social",     "points": 15},
    # Collection
    {"key": "first_card",         "title": "In the Vault",      "desc": "Add a card to your collection.",       "icon": "📦", "category": "collection", "points": 10},
    {"key": "fifty_cards",        "title": "Growing Arsenal",   "desc": "Own 50 cards.",                        "icon": "◆",  "category": "collection", "points": 20},
    {"key": "hundred_cards",      "title": "Armory",            "desc": "Own 100 cards.",                       "icon": "⬡",  "category": "collection", "points": 40},
    {"key": "five_hundred_cards", "title": "War Chest",         "desc": "Own 500 cards.",                       "icon": "⬡",  "category": "collection", "points": 100},
    # Social
    {"key": "first_wishlist",     "title": "Target Acquired",   "desc": "Add a card to your wishlist.",         "icon": "🎯", "category": "social",     "points": 10},
    # Gameplay
    {"key": "first_game",         "title": "Into the Fray",     "desc": "Play your first game.",                "icon": "⚔",  "category": "gameplay",   "points": 10},
    {"key": "first_win",          "title": "Victor",            "desc": "Win your first game.",                 "icon": "✦",  "category": "gameplay",   "points": 20},
    {"key": "ten_wins",           "title": "Seasoned Commander","desc": "Win 10 games.",                        "icon": "◆",  "category": "gameplay",   "points": 50},
    {"key": "cpu_crusher",        "title": "CPU Crusher",       "desc": "Beat the AI on Normal difficulty.",    "icon": "◈",  "category": "gameplay",   "points": 25},
    # Pilot Training rank gates (cumulative)
    {"key": "rank_k1",            "title": "Cadet",             "desc": "Complete K1 Cadet training.",          "icon": "◈",  "category": "training",   "points": 25},
    {"key": "rank_k2",            "title": "Pilot",             "desc": "Complete K2 Pilot training.",          "icon": "◈",  "category": "training",   "points": 50},
    {"key": "rank_k3",            "title": "Flight Lead",       "desc": "Complete K3 Flight Lead training.",    "icon": "◈",  "category": "training",   "points": 75},
    {"key": "rank_k4",            "title": "Squadron",          "desc": "Complete K4 Squadron training.",       "icon": "◈",  "category": "training",   "points": 100},
]

ACHIEVEMENT_KEYS = {a["key"] for a in ACHIEVEMENTS}

ALL_SIX_ASPECTS = {"Heroism", "Villainy", "Command", "Aggression", "Cunning", "Vigilance"}


def _check_all_aspects(user_id: str, app_db: Session, card_db: Session) -> bool:
    """
    Return True if the user's decks collectively include cards from all 6 aspects.
    Heroism/Villainy come from leaders; Command/Aggression/Cunning/Vigilance from
    regular cards. Checks across ALL of the user's decks combined.
    """
    rows = app_db.execute(
        text("""
            SELECT DISTINCT dc.card_id
            FROM deck_cards dc
            JOIN decks d ON dc.deck_id = d.id
            WHERE d.user_id = :uid
        """),
        {"uid": user_id},
    ).fetchall()

    if not rows:
        return False

    card_ids = [r[0] for r in rows]
    placeholders = ", ".join([f":id{i}" for i in range(len(card_ids))])
    params = {f"id{i}": cid for i, cid in enumerate(card_ids)}

    aspect_rows = card_db.execute(
        text(f"SELECT DISTINCT aspect_name FROM card_aspects WHERE card_id IN ({placeholders})"),
        params,
    ).fetchall()

    found_aspects = {r[0] for r in aspect_rows}
    return ALL_SIX_ASPECTS.issubset(found_aspects)


def _compute_earned_keys(
    user_id: str,
    app_db: Session,
    card_db: Session,
    already_earned: set,
) -> list:
    """
    Return list of achievement keys newly earned (not already in already_earned).
    Only checks conditions that are not yet earned to avoid redundant queries.
    """
    needed = ACHIEVEMENT_KEYS - already_earned

    # --- counts (fetched once, used by multiple conditions) ---
    deck_count = app_db.execute(
        text("SELECT COUNT(*) FROM decks WHERE user_id = :uid"),
        {"uid": user_id},
    ).scalar() or 0

    coll_count = app_db.execute(
        text("SELECT COUNT(*) FROM user_collection WHERE user_id = :uid"),
        {"uid": user_id},
    ).scalar() or 0

    wish_count = app_db.execute(
        text("SELECT COUNT(*) FROM user_wishlist WHERE user_id = :uid"),
        {"uid": user_id},
    ).scalar() or 0

    shared_exists = app_db.execute(
        text("SELECT 1 FROM decks WHERE user_id = :uid AND share_token IS NOT NULL LIMIT 1"),
        {"uid": user_id},
    ).fetchone() is not None

    # all_aspects is the most expensive — skip if already earned
    all_asp = (
        _check_all_aspects(user_id, app_db, card_db)
        if "all_aspects" in needed
        else ("all_aspects" in already_earned)
    )

    # gameplay counts — matches table may not exist yet on old DBs; guard gracefully
    try:
        total_games = app_db.execute(
            text("SELECT COUNT(*) FROM matches WHERE player_id = :uid"),
            {"uid": user_id},
        ).scalar() or 0
        total_wins = app_db.execute(
            text("SELECT COUNT(*) FROM matches WHERE player_id = :uid AND result = 'win'"),
            {"uid": user_id},
        ).scalar() or 0
        cpu_normal_wins = app_db.execute(
            text("""
                SELECT COUNT(*) FROM matches
                WHERE player_id = :uid AND result = 'win'
                  AND opponent_type = 'cpu' AND difficulty = 'normal'
            """),
            {"uid": user_id},
        ).scalar() or 0
    except Exception:
        total_games = total_wins = cpu_normal_wins = 0

    conditions = {
        "first_deck":         deck_count >= 1,
        "three_decks":        deck_count >= 3,
        "ten_decks":          deck_count >= 10,
        "all_aspects":        all_asp,
        "first_share":        shared_exists,
        "first_card":         coll_count >= 1,
        "fifty_cards":        coll_count >= 50,
        "hundred_cards":      coll_count >= 100,
        "five_hundred_cards": coll_count >= 500,
        "first_wishlist":     wish_count >= 1,
        # gameplay
        "first_game":         total_games >= 1,
        "first_win":          total_wins >= 1,
        "ten_wins":           total_wins >= 10,
        "cpu_crusher":        cpu_normal_wins >= 1,
    }

    # Rank gates are cumulative
    conditions["rank_k1"] = conditions["first_deck"]
    conditions["rank_k2"] = conditions["rank_k1"] and conditions["three_decks"]
    conditions["rank_k3"] = conditions["rank_k2"] and conditions["all_aspects"]
    conditions["rank_k4"] = conditions["rank_k3"] and conditions["ten_decks"]

    return [key for key, met in conditions.items() if met and key not in already_earned]


def _current_rank(earned: set) -> Optional[str]:
    for rank in ("rank_k4", "rank_k3", "rank_k2", "rank_k1"):
        if rank in earned:
            return rank.split("_")[1].upper()  # 'K4', 'K3', etc.
    return None


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/achievements")
async def get_achievements(
    current_user: User = Depends(get_current_user),
    app_db: Session = Depends(get_app_db),
    card_db: Session = Depends(get_card_db),
):
    """
    Return the full achievement catalog with earned status for the current user.
    Newly earned achievements are inserted on this call (lazy evaluation).
    """
    try:
        # 1. Fetch current earned state
        earned_rows = app_db.execute(
            text("SELECT key, earned_at FROM user_achievements WHERE user_id = :uid"),
            {"uid": current_user.id},
        ).fetchall()
        earned_map = {r[0]: r[1] for r in earned_rows}

        # 2. Compute newly earned
        newly_earned = _compute_earned_keys(
            current_user.id, app_db, card_db, set(earned_map.keys())
        )

        # 3. Insert newly earned (INSERT OR IGNORE handles any race conditions)
        if newly_earned:
            now = datetime.datetime.utcnow()
            for key in newly_earned:
                app_db.execute(
                    text("""
                        INSERT OR IGNORE INTO user_achievements (id, user_id, key, earned_at, source)
                        VALUES (:id, :uid, :key, :now, NULL)
                    """),
                    {"id": str(uuid.uuid4()), "uid": current_user.id, "key": key, "now": now},
                )
                earned_map[key] = now
            app_db.commit()

        # 4. Build response
        total_points = 0
        result = []
        for ach in ACHIEVEMENTS:
            earned = ach["key"] in earned_map
            entry = {**ach, "earned": earned}
            if earned:
                ea = earned_map[ach["key"]]
                entry["earned_at"] = ea.isoformat() if hasattr(ea, "isoformat") else str(ea)
                total_points += ach["points"]
            result.append(entry)

        return {
            "achievements": result,
            "total_points": total_points,
            "rank": _current_rank(set(earned_map.keys())),
        }

    except Exception as e:
        logger.error(f"Error fetching achievements for user {current_user.id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to load achievements")
