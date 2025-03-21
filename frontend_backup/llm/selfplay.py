def train_model_via_self_play(iterations=1000):
    for i in range(iterations):
        # Initialize a new game
        game = StarWarsUnlimitedGame()
        game_history = []
        
        while not game.is_game_over():
            # Current state
            state = game.get_state_representation()
            
            # Model predicts action probabilities and position value
            action_probs, value = model.predict(state)
            
            # Select action (with some exploration)
            action = select_action(action_probs)
            
            # Store state, action probs for learning
            game_history.append((state, action_probs, None))  # Winner unknown yet
            
            # Apply action to game
            game.apply_action(action)
        
        # Game finished - determine winner
        winner = game.get_winner()
        
        # Update game history with actual outcomes
        for i in range(len(game_history)):
            game_history[i] = (game_history[i][0], game_history[i][1], winner)
        
        # Train model on this game's data
        train_on_game_history(model, game_history)