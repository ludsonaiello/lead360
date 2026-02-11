#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"
EMAIL="ludsonaiello@gmail.com"
PASSWORD="978@F32c"

echo "=== Testing CREATE Provider with api_endpoint ==="
echo ""

# Login
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token // .token // empty')

echo "Creating a NEW transcription provider with api_endpoint..."
echo ""

CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/admin/communication/transcription-providers" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_name": "openai_whisper",
    "api_key": "sk-test-key-for-endpoint-testing-12345",
    "api_endpoint": "https://api.openai.com/v1/audio/transcriptions",
    "model": "whisper-1",
    "language": "en",
    "cost_per_minute": 0.006,
    "usage_limit": 10000,
    "is_system_default": false
  }')

echo "Create Response:"
echo "$CREATE_RESPONSE" | jq '.'
echo ""

# Check if creation was successful
NEW_PROVIDER_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

if [ ! -z "$NEW_PROVIDER_ID" ] && [ "$NEW_PROVIDER_ID" != "null" ]; then
  echo "✅ Provider created with ID: $NEW_PROVIDER_ID"
  echo ""
  echo "Fetching the new provider details..."
  
  sleep 1
  
  NEW_PROVIDER_DETAIL=$(curl -s -X GET "${BASE_URL}/admin/communication/transcription-providers/${NEW_PROVIDER_ID}" \
    -H "Authorization: Bearer ${TOKEN}")
  
  echo "$NEW_PROVIDER_DETAIL" | jq '.'
  echo ""
  
  HAS_API_ENDPOINT=$(echo "$NEW_PROVIDER_DETAIL" | jq -r '.api_endpoint // empty')
  
  if [ ! -z "$HAS_API_ENDPOINT" ] && [ "$HAS_API_ENDPOINT" != "null" ]; then
    echo "🎉 SUCCESS! api_endpoint is present: $HAS_API_ENDPOINT"
    echo ""
    echo "✅ Backend fix CONFIRMED!"
    
    # Clean up - delete the test provider
    echo ""
    echo "Cleaning up test provider..."
    DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/admin/communication/transcription-providers/${NEW_PROVIDER_ID}" \
      -H "Authorization: Bearer ${TOKEN}")
    echo "Deleted: $(echo $DELETE_RESPONSE | jq -r '.message // empty')"
  else
    echo "❌ api_endpoint still not present in new provider"
    echo "Backend might need to check the response serialization"
  fi
else
  echo "❌ Failed to create provider"
  echo "Response: $CREATE_RESPONSE"
fi

