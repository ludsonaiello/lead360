#!/bin/bash

# Test Admin Panel Access
# This script tests login and admin dashboard access

API_URL="http://localhost:3000/api/v1"
EMAIL="ludsonaiello@gmail.com"

echo "================================================"
echo "Testing Admin Panel Authentication"
echo "================================================"
echo ""

# Step 1: Login
echo "Step 1: Logging in as platform admin..."
echo "Email: $EMAIL"
echo ""

LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"YourPasswordHere\"
  }")

echo "Login Response:"
echo "$LOGIN_RESPONSE" | jq '.' 2>/dev/null || echo "$LOGIN_RESPONSE"
echo ""

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token' 2>/dev/null)

if [ "$ACCESS_TOKEN" == "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ ERROR: Failed to get access token"
  echo "Please check:"
  echo "  1. Your password is correct"
  echo "  2. The API is running on port 3000"
  echo "  3. The database connection is working"
  exit 1
fi

echo "✅ Login successful!"
echo "Access Token: ${ACCESS_TOKEN:0:50}..."
echo ""

# Step 2: Check user info from token
echo "Step 2: Decoding JWT token to verify is_platform_admin..."
TOKEN_PAYLOAD=$(echo "$ACCESS_TOKEN" | cut -d'.' -f2)
# Pad base64 string if needed
TOKEN_PAYLOAD="${TOKEN_PAYLOAD}$(printf '%*s' $((4 - ${#TOKEN_PAYLOAD} % 4)) '' | tr ' ' '=')"
DECODED=$(echo "$TOKEN_PAYLOAD" | base64 -d 2>/dev/null | jq '.')

echo "$DECODED"
echo ""

IS_PLATFORM_ADMIN=$(echo "$DECODED" | jq -r '.is_platform_admin' 2>/dev/null)
if [ "$IS_PLATFORM_ADMIN" == "true" ]; then
  echo "✅ User is Platform Admin"
else
  echo "❌ ERROR: User is NOT a Platform Admin"
  echo "is_platform_admin: $IS_PLATFORM_ADMIN"
  exit 1
fi
echo ""

# Step 3: Access admin dashboard
echo "Step 3: Accessing admin dashboard metrics..."
echo "Endpoint: $API_URL/admin/dashboard/metrics"
echo ""

METRICS_RESPONSE=$(curl -s -X GET "$API_URL/admin/dashboard/metrics" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Dashboard Metrics Response:"
echo "$METRICS_RESPONSE" | jq '.' 2>/dev/null || echo "$METRICS_RESPONSE"
echo ""

# Check for errors
if echo "$METRICS_RESPONSE" | grep -q "Unauthorized\|Forbidden"; then
  echo "❌ ERROR: Still getting unauthorized/forbidden"
  echo ""
  echo "Possible issues:"
  echo "  1. JWT token not being validated correctly"
  echo "  2. PlatformAdminGuard not reading is_platform_admin from token"
  echo "  3. JWT_SECRET mismatch between .env and what's being used"
else
  echo "✅ SUCCESS: Admin dashboard accessible!"
fi

echo ""
echo "================================================"
echo "Test Complete"
echo "================================================"
