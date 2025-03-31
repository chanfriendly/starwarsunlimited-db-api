# test_register.py - put this in the project root
import requests
import json

# API endpoint
API_URL = "http://localhost:8000/api/auth/register"

# Test user data
test_data = {
    "username": "testuser123",
    "email": "test@example.com",
    "password": "password123"
}

# Make the request
print(f"Sending POST request to {API_URL}")
print(f"With data: {json.dumps(test_data)}")

try:
    response = requests.post(
        API_URL,
        json=test_data,
        headers={"Content-Type": "application/json"}
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {json.dumps(dict(response.headers), indent=2)}")
    
    try:
        print(f"Response Body: {json.dumps(response.json(), indent=2)}")
    except:
        print(f"Response Body (not JSON): {response.text}")
        
except Exception as e:
    print(f"Request Error: {str(e)}")