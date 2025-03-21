def evaluate_play(model, game_state, proposed_action):
    # Get cards involved in the action
    cards_involved = get_cards_in_action(game_state, proposed_action)
    
    # Query vector database for relevant rules and card interactions
    relevant_rules = vector_db.query(
        query=create_query_from_cards(cards_involved),
        top_k=5
    )
    
    # Enhance the game state with this retrieved knowledge
    enhanced_state = enhance_state_with_knowledge(game_state, relevant_rules)
    
    # Evaluate the play with this enhanced knowledge
    return model.evaluate(enhanced_state, proposed_action)