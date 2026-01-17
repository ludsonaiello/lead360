#!/bin/bash

# =============================================================================
# COMPREHENSIVE WEBHOOK TEST - ALL FIELDS
# =============================================================================
# This script tests the webhook endpoint with ALL available fields populated
#
# Requirements:
# 1. Replace YOUR_API_KEY with actual webhook API key from settings UI
# 2. Ensure tenant subdomain is correct (honeydo in this example)
# =============================================================================

# CONFIGURATION
TENANT_SUBDOMAIN="honeydo"
WEBHOOK_URL="https://${TENANT_SUBDOMAIN}.lead360.app/api/v1/public/leads/webhook"
API_KEY="YOUR_API_KEY_HERE"  # Replace with actual key from UI

# TEST DATA - ALL FIELDS POPULATED
echo "=========================================="
echo "COMPREHENSIVE WEBHOOK TEST"
echo "=========================================="
echo "URL: $WEBHOOK_URL"
echo "Tenant: $TENANT_SUBDOMAIN"
echo ""
echo "Sending request with ALL fields..."
echo ""

curl -X POST "$WEBHOOK_URL" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Michael",
    "last_name": "Rodriguez",
    "email": "michael.rodriguez@example.com",
    "phone": "(617) 555-9876",
    "address_line1": "742 Evergreen Terrace",
    "address_line2": "Apartment 3B",
    "city": "Springfield",
    "state": "MA",
    "zip_code": "01101",
    "service_type": "Emergency Plumbing",
    "service_description": "Burst pipe in basement - urgent! Water everywhere, need immediate assistance. Available all day.",
    "external_source_id": "contact_form_2026_01_17_001"
  }' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  -v

echo ""
echo "=========================================="
echo "TEST COMPLETE"
echo "=========================================="
echo ""
echo "Expected Results:"
echo "- HTTP 201 Created: Lead created successfully"
echo "- HTTP 401 Unauthorized: Invalid API key (replace YOUR_API_KEY_HERE)"
echo "- HTTP 409 Conflict: Duplicate phone or external_source_id"
echo ""
echo "Check the UI at: https://app.lead360.app/leads"
echo ""
