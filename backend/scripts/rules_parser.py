import os
from typing import List, Dict
import logging
import re

logger = logging.getLogger(__name__)

def parse_rulebook(file_path: str) -> List[Dict[str, str]]:
    """Parse the rulebook PDF or text file into structured sections.
    
    Args:
        file_path: Path to the rulebook file
        
    Returns:
        List of dictionaries containing structured rule sections
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Rulebook not found at: {file_path}")
    
    sections = []
    current_section = None
    current_text = []
    
    try:
        with open(file_path, 'r', encoding='ISO-8859-1') as f:
            content = f.read()
            
        # Split content into lines
        lines = content.split('\n')
        
        # Pattern for section headers (e.g., "1. Game Setup" or "Section 1: Game Setup")
        section_pattern = re.compile(r'^(?:Section\s+)?(\d+)[.:]?\s+(.+)$')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if this is a new section
            match = section_pattern.match(line)
            if match:
                # Save previous section if it exists
                if current_section and current_text:
                    sections.append({
                        "title": current_section["title"],
                        "section": current_section["number"],
                        "text": "\n".join(current_text).strip()
                    })
                
                # Start new section
                current_section = {
                    "number": match.group(1),
                    "title": match.group(2)
                }
                current_text = []
            else:
                # Add line to current section
                if current_section:
                    current_text.append(line)
        
        # Add the last section
        if current_section and current_text:
            sections.append({
                "title": current_section["title"],
                "section": current_section["number"],
                "text": "\n".join(current_text).strip()
            })
        
        logger.info(f"Successfully parsed {len(sections)} sections from rulebook")
        return sections
        
    except Exception as e:
        logger.error(f"Error parsing rulebook: {e}")
        raise 