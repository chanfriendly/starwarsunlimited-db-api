def model_to_dict(model, exclude_fields=None):
    """Convert SQLAlchemy model to dictionary.
    
    Args:
        model: SQLAlchemy model instance
        exclude_fields: List of field names to exclude (e.g., password_hash)
        
    Returns:
        Dictionary with model attributes
    """
    if exclude_fields is None:
        exclude_fields = []
        
    return {
        column.name: getattr(model, column.name)
        for column in model.__table__.columns
        if column.name not in exclude_fields
    }