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
        """Initialize the vector database client.
        Sets up connections to both Qdrant and OpenAI."""
        # Initialize Qdrant client
        self.collection_name = "cards"
        self.rules_collection_name = "rules"
        
        self.qdrant = QdrantClient(
            host=os.getenv('QDRANT_HOST', "localhost"),  # Default to localhost if not specified
            port=int(os.getenv('QDRANT_PORT', 6333))
        )
        
        # Initialize OpenAI client
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is not set")
            
        # Create OpenAI client instance
        self.openai_client = OpenAI(api_key=api_key)

    def setup_collections(self) -> None:
        """Create and configure the vector collections if they don't exist.
        We use separate collections for cards and rules to keep concerns separated."""
        try:
            collections = self.qdrant.get_collections().collections
            
            # Setup cards collection if it doesn't exist
            if not any(c.name == self.collection_name for c in collections):
                self.qdrant.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=1536,  # Size for OpenAI's text-embedding-3-small model
                        distance=models.Distance.COSINE
                    )
                )
                logger.info(f"Created new collection: {self.collection_name}")
            
            # Setup rules collection if it doesn't exist
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
        """Generate embedding for text using OpenAI's API.
        
        Args:
            text: The text to generate an embedding for
            
        Returns:
            List[float]: The embedding vector
        """
        try:
            # Use the new API format for creating embeddings
            response = self.openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=text.strip()
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            raise

    def generate_card_embedding(self, card: Dict) -> List[float]:
        """Generate embedding for a card by creating a rich text representation.
        
        Args:
            card: Dictionary containing card information
            
        Returns:
            List[float]: The embedding vector
        """
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
        for i, section in enumerate(rules_sections):
            try:
                logger.info(f"Processing rule section {i + 1}/{len(rules_sections)}")
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
                logger.error(f"Error indexing rule section {i}: {e}")
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