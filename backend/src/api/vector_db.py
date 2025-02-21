from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer
import os
from typing import List, Dict, Optional
import logging
from dotenv import load_dotenv
import uuid

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VectorDB:
    def __init__(self):
        """Initialize the vector database client."""
        self.collection_name = "cards"
        self.rules_collection_name = "rules"
        
        # Initialize Qdrant client with NAS address
        self.qdrant = QdrantClient(
            host=os.getenv('QDRANT_HOST', "192.168.1.124"),
            port=int(os.getenv('QDRANT_PORT', 6333))
        )
        
        # Initialize Sentence Transformer model
        # Using all-MiniLM-L6-v2 as it's fast and good for semantic similarity
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.embedding_dim = self.model.get_sentence_embedding_dimension()
        logger.info(f"Initialized with embedding dimension: {self.embedding_dim}")

    def setup_collections(self) -> None:
        """Create and configure the vector collections if they don't exist or have wrong dimensions."""
        try:
            # Get list of existing collections
            collections = self.qdrant.get_collections().collections
            existing_collections = {c.name: c for c in collections}

            # Helper function to check if collection needs recreation
            def needs_recreation(collection_name) -> bool:
                if collection_name not in existing_collections:
                    return True
                    
                # Get detailed collection info
                try:
                    collection_info = self.qdrant.get_collection(collection_name)
                    vector_size = collection_info.config.params.vectors.size
                    return vector_size != self.embedding_dim
                except Exception as e:
                    logger.warning(f"Failed to get vector size for collection {collection_name}: {e}")
                    # If we can't verify the size, assume we need to recreate
                    return True

            # Check and setup cards collection
            if needs_recreation(self.collection_name):
                if self.collection_name in existing_collections:
                    logger.info(f"Deleting existing {self.collection_name} collection with wrong dimensions")
                    self.qdrant.delete_collection(self.collection_name)
            
                self.qdrant.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=models.VectorParams(
                        size=self.embedding_dim,
                        distance=models.Distance.COSINE
                    )
                )
                logger.info(f"Created {self.collection_name} collection with dimension {self.embedding_dim}")
            
            # Check and setup rules collection
            if needs_recreation(self.rules_collection_name):
                if self.rules_collection_name in existing_collections:
                    logger.info(f"Deleting existing {self.rules_collection_name} collection with wrong dimensions")
                    self.qdrant.delete_collection(self.rules_collection_name)
                
                self.qdrant.create_collection(
                    collection_name=self.rules_collection_name,
                    vectors_config=models.VectorParams(
                        size=self.embedding_dim,
                        distance=models.Distance.COSINE
                    )
                )
                logger.info(f"Created {self.rules_collection_name} collection with dimension {self.embedding_dim}")

        except Exception as e:
            logger.error(f"Error setting up collections: {e}")
            raise

    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for text using Sentence Transformers."""
        try:
            # Clean and prepare text
            cleaned_text = text.strip()
            if not cleaned_text:
                raise ValueError("Empty text provided for embedding")
                
            # Convert text to vector embedding
            embedding = self.model.encode(cleaned_text, convert_to_tensor=False)
            return embedding.tolist()
        except Exception as e:
            logger.error(f"Embedding generation error: {e}")
            raise

    def generate_card_embedding(self, card: Dict) -> List[float]:
        """Generate embedding for a card by combining its relevant attributes."""
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
            # Process rules in batches for efficiency
            batch_size = 100
            for i in range(0, len(rules_sections), batch_size):
                batch = rules_sections[i:i + batch_size]
                points = []
                
                for section in batch:
                    # Generate embedding for the section text
                    embedding = self.generate_embedding(section['text'])
                    
                    # Create a UUID for this section
                    point_id = str(uuid.uuid4())
                    
                    # Create point structure with UUID
                    points.append(models.PointStruct(
                        id=point_id,  # UUID string as point ID
                        vector=embedding,
                        payload={
                            'title': section.get('title', ''),
                            'text': section['text'],
                            'section': section.get('section', ''),
                            'subsection': section.get('subsection', '')
                        }
                    ))
                
                # Insert batch of points
                self.qdrant.upsert(
                    collection_name=self.rules_collection_name,
                    points=points
                )
                logger.info(f"Indexed rules batch {i//batch_size + 1}, containing {len(batch)} sections")
                
        except Exception as e:
            logger.error(f"Error indexing rules: {e}")
            raise

    def generate_stable_card_uuid(self, card: Dict) -> str:
        """Generate a stable UUID for a card based on its unique attributes.
        
        We use name and set number to ensure the same card always gets the same UUID,
        even if we rebuild the database from scratch.
        """
        # Create a unique string combining card name and set number
        unique_string = f"{card['name']}_{card.get('set_name', '')}_{card.get('card_number', '')}"
        # Generate a UUID using version 5 (SHA-1) with our namespace
        namespace_uuid = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')  # UUID namespace for URLs
        return str(uuid.uuid5(namespace_uuid, unique_string))

    async def index_card(self, card: Dict) -> None:
        """Index a single card in the vector database."""
        try:
            embedding = self.generate_card_embedding(card)
            
            # Generate a stable UUID for this card
            card_id = self.generate_stable_card_uuid(card)
            
            self.qdrant.upsert(
                collection_name=self.collection_name,
                points=[models.PointStruct(
                    id=card_id,
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