from striprtf.striprtf import rtf_to_text
import re

# Function to clean the text
def clean_text(text):
    # Remove line numbers (e.g., "1. ", "2. ", etc.)
    text = re.sub(r'^\d+\.\s*', '', text, flags=re.MULTILINE)
    
    # Replace special characters with their correct representations
    replacements = {
        '™': '™',
        '“': '"',
        '”': '"',
        '‘': "'",
        '’': "'",
        '–': '-',
        '…': '...',
        '•': '*',
        '•': '*',
        '©': '©',
        '®': '®',
        '℗': '℗',
        '•': '*',
        '•': '*',
        '…': '...',
    }
    
    for old, new in replacements.items():
        text = text.replace(old, new)

    # Ensure consistent spacing between sections
    text = re.sub(r'\n\s*\n+', '\n\n', text)  # Remove extra newlines
    text = re.sub(r'\n+', '\n\n', text)  # Ensure double newlines between sections

    return text.strip()

# Read the RTF file
with open('rulebook.rtf', 'r', encoding='utf-8') as rtf_file:
    rtf_content = rtf_file.read()

# Convert RTF to plain text
plain_text = rtf_to_text(rtf_content)

# Clean up the text
cleaned_text = clean_text(plain_text)

# Save the cleaned text to a file
with open('rulebook_cleaned.txt', 'w', encoding='utf-8') as text_file:
    text_file.write(cleaned_text)

print("Conversion and cleaning complete! The cleaned text is saved as 'rulebook_cleaned.txt'.")
