from qdrant_client import QdrantClient
from qdrant_client.http import models
from openai import OpenAI
import os
from typing import List, Dict, Optional
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VectorDB:
    def __init__(self):
        """Initialize the vector database client."""
        self.collection_name = "cards"  # Define the collection name for cards
        self.rules_collection_name = "rules"  # Define the collection name for rules
        
        self.qdrant = QdrantClient(
            host=os.getenv('QDRANT_HOST', "192.168.1.124"),
            port=int(os.getenv('QDRANT_PORT', 6333))
        )
        
        # Initialize OpenAI client
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
        OpenAI.api_key = api_key
        OpenAI.api_base = "https://api.openai.com/v1"
        
        # Create an OpenAI client instance
        self.openai_client = OpenAI()

    def setup_collections(self) -> None:
        """Create and configure the vector collections if they don't exist."""
        try:
            collections = self.qdrant.get_collections().collections
            
            # Setup cards collection
            if not any(c.name == self.collection_name for c in collections):
                self.qdrant.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=1536,
                        distance=models.Distance.COSINE
                    )
                )
                logger.info(f"Created new collection: {self.collection_name}")
            
            # Setup rules collection
            if not any(c.name == self.rules_collection_name for c in collections):
                self.qdrant.create_collection(
                    collection_name=self.rules_collection_name,
                    vectors_config=models.VectorParams(
                        size=1536,
                        distance=models.Distance.COSINE
                    )
                )
                logger.info(f"Created new collection: {self.rules_collection_name}")

        except Exception as e:
            logger.error(f"Error setting up collections: {e}")
            raise

    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for any text using OpenAI's API."""
        try:
            response = OpenAI.Embedding.create(
                model="text-embedding-3-small",
                input=text.strip(),
                encoding_format="float"
            )
            return response['data'][0]['embedding']
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def generate_card_embedding(self, card: Dict) -> List[float]:
        """Generate embedding for a card using OpenAI's API."""
        try:
            # Create a rich text representation of the card
            text_to_embed = f"""
            Name: {card.get('name', '')}
            Type: {card.get('type', '')}
            Text: {card.get('text', '')}
            Aspects: {', '.join(a['aspect_name'] for a in card.get('aspects', []))}
            Keywords: {', '.join(card.get('keywords', []))}
            Stats: Cost {card.get('energy_cost', 'N/A')}, Attack {card.get('attack', 'N/A')}, Health {card.get('health', 'N/A')}
            Traits: {', '.join(card.get('traits', []))}
            """
            return self.generate_embedding(text_to_embed)
        except Exception as e:
            logger.error(f"Error generating embedding for card {card.get('name')}: {e}")
            raise

    async def index_rules(self, rules_sections: List[Dict[str, str]]) -> None:
        """Index rulebook sections in the vector database."""
        try:
            for i, section in enumerate(rules_sections):
                embedding = self.generate_embedding(section['text'])
                
                self.qdrant.upsert(
                    collection_name=self.rules_collection_name,
                    points=[models.PointStruct(
                        id=str(i),
                        vector=embedding,
                        payload={
                            'title': section.get('title', ''),
                            'text': section['text'],
                            'section': section.get('section', ''),
                            'subsection': section.get('subsection', '')
                        }
                    )]
                )
                logger.info(f"Indexed rules section: {section.get('title', f'Section {i}')}")
        except Exception as e:
            logger.error(f"Error indexing rules: {e}")
            raise

    async def index_card(self, card: Dict) -> None:
        """Index a single card in the vector database."""
        try:
            embedding = self.generate_card_embedding(card)
            
            self.qdrant.upsert(
                collection_name=self.collection_name,
                points=[models.PointStruct(
                    id=card['id'],
                    vector=embedding,
                    payload={
                        'name': card['name'],
                        'type': card['type'],
                        'text': card.get('text', ''),
                        'aspects': [a['aspect_name'] for a in card.get('aspects', [])],
                        'keywords': card.get('keywords', []),
                        'energy_cost': card.get('energy_cost'),
                        'attack': card.get('attack'),
                        'health': card.get('health')
                    }
                )]
            )
            logger.info(f"Indexed card: {card['name']}")

        except Exception as e:
            logger.error(f"Error indexing card {card.get('name')}: {e}")
            raise

    async def find_similar_cards(self, card_id: str, limit: int = 5) -> List[Dict]:
        """Find cards similar to the given card."""
        try:
            # Get the vector of the target card
            search_result = self.qdrant.search(
                collection_name=self.collection_name,
                query_vector=self.qdrant.retrieve(
                    collection_name=self.collection_name,
                    ids=[card_id]
                )[0].vector,
                limit=limit + 1  # Add 1 to account for the query card itself
            )

            # Filter out the query card and return similar cards
            similar_cards = [
                hit.payload for hit in search_result 
                if str(hit.id) != card_id
            ][:limit]

            return similar_cards

        except Exception as e:
            logger.error(f"Error finding similar cards for {card_id}: {e}")
            raise

    async def search_cards_by_description(self, description: str, limit: int = 10) -> List[Dict]:
        """Search for cards using a natural language description."""
        try:
            # Generate embedding for the description
            embedding = self.generate_card_embedding(description)

            # Search for similar cards
            search_result = self.qdrant.search(
                collection_name=self.collection_name,
                query_vector=embedding,
                limit=limit
            )

            return [hit.payload for hit in search_result]

        except Exception as e:
            logger.error(f"Error searching cards by description: {e}")
            raise

    async def suggest_deck_additions(self, deck_cards: List[str], limit: int = 5) -> List[Dict]:
        """Suggest cards that would work well with the current deck."""
        try:
            # Get embeddings for all deck cards
            deck_vectors = []
            for card_id in deck_cards:
                card_vector = self.qdrant.retrieve(
                    collection_name=self.collection_name,
                    ids=[card_id]
                )[0].vector
                deck_vectors.append(card_vector)

            # Calculate average deck vector
            avg_vector = [sum(x) / len(x) for x in zip(*deck_vectors)]

            # Search for similar cards
            search_result = self.qdrant.search(
                collection_name=self.collection_name,
                query_vector=avg_vector,
                limit=limit + len(deck_cards)  # Add extra to account for filtering
            )

            # Filter out cards already in the deck
            suggestions = [
                hit.payload for hit in search_result 
                if str(hit.id) not in deck_cards
            ][:limit]

            return suggestions

        except Exception as e:
            logger.error(f"Error suggesting deck additions: {e}")
            raise 