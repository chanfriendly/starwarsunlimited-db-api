# Star Wars Unlimited Card Database Builder

This project provides tools to build and maintain a local database of Star Wars Unlimited cards using the official Star Wars Unlimited API. It's designed to handle the unique characteristics of different card types including Leaders (double-sided), Bases, and standard cards.




_Please understand, this is a project for me to learn; I am, in most ways, a novice, and it may take me time to respond, understand, or correct issues. Please be patient, or if you're more advanced and have the passion, take this and run with it farther and faster than I can. I want to see the community, and resources for it, grow._

## Overview

Star Wars Unlimited is a new trading card game from Fantasy Flight Games. This tool helps you create and maintain a local database of all cards, which can be useful for:

- Building deck analysis tools
- Creating card search applications
- Tracking card prices and availability
- Powering local game tools and utilities

## Features

- Fetches complete card data from the official Star Wars Unlimited API
- Handles all card types (Leaders, Bases, Units, Events, etc.)
- Stores both card faces for Leader cards
- Maintains relationships between cards and their aspects, keywords, traits, and arenas
- Includes price history tracking capability
- Provides detailed logging of the database building process
- Rate-limited API access to be respectful of the server

## Requirements

- Python 3.10 or higher
- SQLite3
- Required Python packages (see requirements.txt):
  - requests==2.31.0

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/swu-card-database.git
cd swu-card-database
```

2. Install required packages:
```bash
pip install -r requirements.txt
```

## Usage

To build the database, simply run:
```bash
python build_database.py
```

This will:
1. Create a new SQLite database (swu_cards.db)
2. Fetch all cards from the Star Wars Unlimited API
3. Process and store the cards with their associated data
4. Create log files detailing the build process

## Database Schema

The database uses multiple tables to store card information:

### Main Tables
- `cards`: Core card information (name, cost, stats, etc.)
- `price_history`: Historical price data for cards
- `card_aspects`: Card faction/alignment information
- `card_keywords`: Card keyword abilities
- `card_traits`: Card traits (Force, Pilot, etc.)
- `card_arenas`: Card arena affiliations (Ground, Space)

### Key Fields
- Each card entry includes:
  - Basic information (name, type, cost, etc.)
  - Card text and abilities
  - Image URIs (including back face for Leaders)
  - Set information
  - Release data
  - Current price data

## Error Handling

The tool includes robust error handling and logging:
- Detailed logs are written to `swu_api.log` and `database_build.log`
- Failed card processing is logged but doesn't stop the build
- Rate limiting is implemented to prevent API overload

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

Some areas where help would be particularly appreciated:
- Additional data validation checks
- Enhanced price tracking features
- Support for more card attributes
- Improved error handling
- Documentation improvements

## License

[MIT](https://choosealicense.com/licenses/mit/)

## Acknowledgments

- Star Wars Unlimited card data is provided by Fantasy Flight Games
- This project is not affiliated with or endorsed by Fantasy Flight Games or Disney
- Thanks to the Star Wars Unlimited community for their support and feedback

## Notes

Please be respectful when using the API:
- Implement appropriate rate limiting
- Cache data when possible
- Don't hammer the API with unnecessary requests

The database schema is designed to be extensible for future card sets and features. If you need to store additional card attributes, the schema can be extended without breaking existing functionality.

## Contact

If you have questions or need help with the project, please:
1. Open an issue in this repository
2. Check existing issues for answers

Please understand, this is a project for me to learn; I am, in most ways, a novice, and it may take me time to respond, understand, or correct issues. Please be patient, or if you're more advanced and have the passion, take this and run with it farther and faster than I can. I want to see the community, and resources for it, grow.
