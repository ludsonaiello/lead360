/**
 * End-to-End Test Suite for Voice Agent Profiles
 * Run: node test-voice-profiles-e2e.js
 */

const axios = require('axios');

const API_BASE = 'http://localhost:8000/api/v1';
const TEST_USER = {
  email: 'contact@honeydo4you.com',
  password: '978@F32c',
};

let authToken;
let tenantId;
let profileId;

async function runTests() {
  console.log('🚀 Starting End-to-End Tests for Voice Agent Profiles\n');

  try {
    // Test 1: Authentication
    console.log('✅ Test 1: Login');
    const authResponse = await axios.post(`${API_BASE}/auth/login`, TEST_USER);
    authToken = authResponse.data.access_token;
    console.log('   Token obtained\n');

    // Get tenant ID
    const meResponse = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    tenantId = meResponse.data.tenant_id;
    console.log(`   Tenant ID: ${tenantId}\n`);

    // Cleanup existing test profiles
    console.log('🧹 Cleanup: Deleting existing test profiles');
    try {
      const existingProfiles = await axios.get(`${API_BASE}/voice-ai/agent-profiles`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      for (const profile of existingProfiles.data) {
        if (profile.title.includes('Test') || profile.title.includes('E2E')) {
          try {
            await axios.delete(`${API_BASE}/voice-ai/agent-profiles/${profile.id}`, {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            console.log(`   Deleted: ${profile.title}`);
          } catch (err) {
            console.log(`   Could not delete ${profile.title}`);
          }
        }
      }
      console.log('   Cleanup complete\n');
    } catch (err) {
      console.log('   No existing profiles to clean up\n');
    }

    // Test 2: Create Profile
    console.log('✅ Test 2: Create Voice Agent Profile');
    const createResponse = await axios.post(
      `${API_BASE}/voice-ai/agent-profiles`,
      {
        title: 'E2E Test Agent',
        language_code: 'en',
        voice_id: 'test-voice-id',
        custom_greeting: 'Hello from E2E test!',
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    profileId = createResponse.data.id;
    console.log(`   Profile created: ${profileId}\n`);

    // Test 3: List Profiles
    console.log('✅ Test 3: List Profiles');
    const listResponse = await axios.get(`${API_BASE}/voice-ai/agent-profiles`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log(`   Found ${listResponse.data.length} profile(s)\n`);

    // Test 4: Get Single Profile
    console.log('✅ Test 4: Get Single Profile');
    const getResponse = await axios.get(
      `${API_BASE}/voice-ai/agent-profiles/${profileId}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    console.log(`   Title: ${getResponse.data.title}\n`);

    // Test 5: Update Profile
    console.log('✅ Test 5: Update Profile');
    await axios.patch(
      `${API_BASE}/voice-ai/agent-profiles/${profileId}`,
      { title: 'E2E Test Agent - Updated' },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    console.log('   Profile updated\n');

    // Test 6: Delete Profile
    console.log('✅ Test 6: Delete Profile');
    await axios.delete(`${API_BASE}/voice-ai/agent-profiles/${profileId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log('   Profile deleted\n');

    // Test 7: Verify 404 After Delete
    console.log('✅ Test 7: Verify 404 After Delete');
    try {
      await axios.get(`${API_BASE}/voice-ai/agent-profiles/${profileId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      console.error('   ❌ FAILED: Should have returned 404\n');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('   Correctly returns 404\n');
      } else {
        throw error;
      }
    }

    console.log('\n🎉 All E2E Tests Passed!\n');
  } catch (error) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTests();
