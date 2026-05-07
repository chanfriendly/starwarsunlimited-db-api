"""
API endpoint tests — auth, cards, deck CRUD.

Temp SQLite files are used so tests are self-contained. Env vars are set
before any src imports so db.py initialises its engines with the test paths.
Route handlers that call get_card_db() directly (bypassing DI) therefore
also hit the test DB automatically.
"""

import os
import uuid
import pytest

# Set paths BEFORE any src imports — db.py reads these at module load time.
_TEST_APP_DB = "/tmp/swu_test_app.db"
_TEST_CARD_DB = "/tmp/swu_test_cards.db"

os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_APP_DB}"
os.environ["CARD_DATABASE_URL"] = f"sqlite:///{_TEST_CARD_DB}"
os.environ["DB_DIR"] = "/tmp/swu_test"
os.environ["JWT_SECRET"] = "test-secret-key-not-for-production"

from sqlalchemy import text
from starlette.testclient import TestClient

from src.database.base import Base
from src.database.db import app_engine as APP_ENGINE, card_engine as CARD_ENGINE
from src.api.main import app
import src.auth.routes as auth_routes

# Disable per-IP auth rate limiter (all test requests share "testserver" IP)
app.dependency_overrides[auth_routes._check_auth_rate_limit] = lambda: None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all ORM tables and seed card data once per test session."""
    import src.database.models  # registers models with Base.metadata
    Base.metadata.create_all(bind=APP_ENGINE)

    with CARD_ENGINE.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                name TEXT,
                subtitle TEXT,
                energy_cost INTEGER,
                type TEXT,
                rarity TEXT,
                image_uri TEXT,
                set_name TEXT,
                set_code TEXT,
                attack INTEGER,
                health INTEGER
            )
        """))
        conn.execute(text("CREATE TABLE IF NOT EXISTS card_aspects (card_id TEXT, aspect_name TEXT, aspect_color TEXT)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS card_keywords (card_id TEXT, keyword TEXT)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS card_traits  (card_id TEXT, trait TEXT)"))
        conn.execute(text("CREATE TABLE IF NOT EXISTS card_arenas  (card_id TEXT, arena TEXT)"))

        # Seed: 2 leaders, 1 base, 2 unit cards
        conn.execute(text("""
            INSERT OR IGNORE INTO cards VALUES
                ('L1', 'Test Leader One', NULL, 6, 'Leader', 'Common', 'https://example.com/l1.png', 'Test Set', 'TST', NULL, NULL),
                ('L2', 'Test Leader Two', NULL, 6, 'Leader', 'Common', 'https://example.com/l2.png', 'Test Set', 'TST', NULL, NULL),
                ('B1', 'Test Base',       NULL, 0, 'Base',   'Common', 'https://example.com/b1.png', 'Test Set', 'TST', NULL, NULL),
                ('C1', 'Test Unit One',   NULL, 2, 'Unit',   'Common', 'https://example.com/c1.png', 'Test Set', 'TST', 2,    4   ),
                ('C2', 'Test Unit Two',   NULL, 3, 'Unit',   'Common', 'https://example.com/c2.png', 'Test Set', 'TST', 3,    5   )
        """))
        conn.execute(text("""
            INSERT OR IGNORE INTO card_aspects VALUES
                ('L1', 'Heroism', '#ffffff'),
                ('L2', 'Command', '#0b992d')
        """))
        conn.commit()

    yield

    Base.metadata.drop_all(bind=APP_ENGINE)
    for f in (_TEST_APP_DB, _TEST_CARD_DB):
        if os.path.exists(f):
            os.remove(f)


@pytest.fixture(autouse=True)
def clean_app_db():
    """Wipe user-data tables and rate limit state between tests."""
    yield
    with APP_ENGINE.connect() as conn:
        conn.execute(text("DELETE FROM deck_cards"))
        conn.execute(text("DELETE FROM decks"))
        conn.execute(text("DELETE FROM user_collection"))
        conn.execute(text("DELETE FROM user_wishlist"))
        conn.execute(text("DELETE FROM users"))
        conn.commit()
    # Reset module-level rate limit counters so they don't bleed across tests
    auth_routes._auth_attempts.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _register_and_login(client, username="testuser", password="testpass123"):
    """Register a user and return their Bearer token."""
    client.post("/api/auth/register", json={"username": username, "email": f"{username}@test.com", "password": password})
    r = client.post(
        "/api/auth/token",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, f"login failed: {r.text}"
    return r.json()["access_token"]


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------

class TestAuth:
    def test_register_success(self, client):
        r = client.post("/api/auth/register", json={
            "username": "newuser", "email": "new@test.com", "password": "pass1234"
        })
        assert r.status_code == 200
        assert r.json()["username"] == "newuser"

    def test_register_duplicate_username(self, client):
        payload = {"username": "dupeuser", "email": "a@test.com", "password": "pass1234"}
        client.post("/api/auth/register", json=payload)
        r = client.post("/api/auth/register", json={"username": "dupeuser", "email": "b@test.com", "password": "pass1234"})
        assert r.status_code in (400, 409, 422)

    def test_login_success(self, client):
        client.post("/api/auth/register", json={"username": "loginuser", "email": "l@test.com", "password": "pass1234"})
        r = client.post(
            "/api/auth/token",
            data={"username": "loginuser", "password": "pass1234"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["token_type"] == "bearer"

    def test_login_wrong_password(self, client):
        client.post("/api/auth/register", json={"username": "wpuser", "email": "wp@test.com", "password": "correct"})
        r = client.post(
            "/api/auth/token",
            data={"username": "wpuser", "password": "wrong"},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        assert r.status_code == 401

    def test_me_authenticated(self, client):
        token = _register_and_login(client, "meuser", "pass1234")
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["username"] == "meuser"

    def test_me_unauthenticated(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401

    def test_me_bad_token(self, client):
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer notavalidtoken"})
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Cards tests
# ---------------------------------------------------------------------------

class TestCards:
    def test_cards_list(self, client):
        r = client.get("/api/cards")
        assert r.status_code == 200
        body = r.json()
        assert "data" in body
        assert "meta" in body
        assert body["meta"]["total"] >= 5

    def test_cards_pagination(self, client):
        r1 = client.get("/api/cards?limit=2&page=1")
        r2 = client.get("/api/cards?limit=2&page=2")
        assert r1.status_code == 200
        assert r2.status_code == 200
        ids1 = {c["id"] for c in r1.json()["data"]}
        ids2 = {c["id"] for c in r2.json()["data"]}
        assert ids1.isdisjoint(ids2), "page 1 and page 2 should return different cards"

    def test_cards_filter_by_type(self, client):
        r = client.get("/api/cards?type=Leader")
        assert r.status_code == 200
        for card in r.json()["data"]:
            assert card["type"] == "Leader"

    def test_cards_filter_by_type_base(self, client):
        r = client.get("/api/cards?type=Base")
        assert r.status_code == 200
        for card in r.json()["data"]:
            assert card["type"] == "Base"

    def test_cards_search_by_name(self, client):
        r = client.get("/api/cards?search=Test+Leader+One")
        assert r.status_code == 200
        data = r.json()["data"]
        assert any("Test Leader One" in c["name"] for c in data)

    def test_cards_meta_fields(self, client):
        meta = client.get("/api/cards?limit=2").json()["meta"]
        assert "total" in meta
        assert "page" in meta
        assert "limit" in meta
        assert meta["limit"] == 2


# ---------------------------------------------------------------------------
# Deck CRUD tests
# ---------------------------------------------------------------------------

class TestDecks:
    def _auth_header(self, client):
        token = _register_and_login(client, "deckuser", "pass1234")
        return {"Authorization": f"Bearer {token}"}

    def _create_deck(self, client, headers, name="My Deck"):
        return client.post("/api/me/decks", json={
            "name": name,
            "leaders": ["L1", "L2"],
            "base": "B1",
            "cards": [
                {"card_id": "C1", "quantity": 3},
                {"card_id": "C2", "quantity": 3},
            ],
        }, headers=headers)

    def test_create_deck(self, client):
        h = self._auth_header(client)
        r = self._create_deck(client, h)
        assert r.status_code in (200, 201)
        body = r.json()
        assert body["name"] == "My Deck"
        assert body["user_id"] is not None
        assert len(body["leaders"]) == 2
        assert body["base"] is not None

    def test_list_decks(self, client):
        h = self._auth_header(client)
        self._create_deck(client, h, "Deck A")
        self._create_deck(client, h, "Deck B")
        r = client.get("/api/me/decks", headers=h)
        assert r.status_code == 200
        names = [d["name"] for d in r.json()]
        assert "Deck A" in names
        assert "Deck B" in names

    def test_get_deck_by_id(self, client):
        h = self._auth_header(client)
        created = self._create_deck(client, h).json()
        deck_id = created["id"]
        r = client.get(f"/api/me/decks/{deck_id}", headers=h)
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == deck_id
        # Leaders should be enriched with names from card DB
        assert any(l.get("name") for l in body["leaders"])

    def test_get_deck_not_found(self, client):
        h = self._auth_header(client)
        r = client.get(f"/api/me/decks/{uuid.uuid4()}", headers=h)
        assert r.status_code == 404

    def test_update_deck(self, client):
        h = self._auth_header(client)
        deck_id = self._create_deck(client, h).json()["id"]
        r = client.put(f"/api/me/decks/{deck_id}", json={
            "name": "Renamed Deck",
            "leaders": ["L1", "L2"],
            "base": "B1",
            "cards": [{"card_id": "C1", "quantity": 5}],
        }, headers=h)
        assert r.status_code == 200
        assert r.json()["name"] == "Renamed Deck"

    def test_delete_deck(self, client):
        h = self._auth_header(client)
        deck_id = self._create_deck(client, h).json()["id"]
        r = client.delete(f"/api/me/decks/{deck_id}", headers=h)
        assert r.status_code in (200, 204)
        # Confirm gone
        r2 = client.get(f"/api/me/decks/{deck_id}", headers=h)
        assert r2.status_code == 404

    def test_deck_isolation_between_users(self, client):
        """User A cannot see User B's decks."""
        token_a = _register_and_login(client, "usera", "pass1234")
        token_b = _register_and_login(client, "userb", "pass1234")
        h_a = {"Authorization": f"Bearer {token_a}"}
        h_b = {"Authorization": f"Bearer {token_b}"}

        deck_id = self._create_deck(client, h_a).json()["id"]
        r = client.get(f"/api/me/decks/{deck_id}", headers=h_b)
        assert r.status_code == 404

    def test_unauthenticated_deck_access(self, client):
        r = client.get("/api/me/decks")
        assert r.status_code == 401


# ---------------------------------------------------------------------------
# Collection tests
# ---------------------------------------------------------------------------

class TestCollection:
    def _auth_header(self, client):
        token = _register_and_login(client, "colluser", "pass1234")
        return {"Authorization": f"Bearer {token}"}

    def test_add_card_to_collection(self, client):
        h = self._auth_header(client)
        r = client.post("/api/me/collection", json={"card_id": "C1", "count": 2}, headers=h)
        assert r.status_code == 200
        assert r.json()["count"] == 2
        assert r.json()["in_collection"] is True

    def test_get_collection(self, client):
        h = self._auth_header(client)
        client.post("/api/me/collection", json={"card_id": "C1", "count": 1}, headers=h)
        r = client.get("/api/me/collection", headers=h)
        assert r.status_code == 200
        assert len(r.json()) == 1
        assert r.json()[0]["count"] == 1

    def test_update_collection_count(self, client):
        h = self._auth_header(client)
        client.post("/api/me/collection", json={"card_id": "C1", "count": 1}, headers=h)
        client.post("/api/me/collection", json={"card_id": "C1", "count": 4}, headers=h)
        r = client.get("/api/me/collection", headers=h)
        items = [i for i in r.json() if i["card"]["id"] == "C1"]
        assert items[0]["count"] == 4

    def test_remove_from_collection(self, client):
        h = self._auth_header(client)
        client.post("/api/me/collection", json={"card_id": "C1", "count": 1}, headers=h)
        client.post("/api/me/collection", json={"card_id": "C1", "count": 0}, headers=h)
        r = client.get("/api/me/collection", headers=h)
        assert r.json() == []

    def test_collection_unauthenticated(self, client):
        r = client.get("/api/me/collection")
        assert r.status_code == 401
