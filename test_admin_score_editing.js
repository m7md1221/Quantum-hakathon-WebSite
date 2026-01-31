/**
 * Test script for Admin Score Editing Feature
 * Tests the new capability to edit evaluation scores with admin notes
 */

const http = require('http');

// Mock token - replace with a real admin token in production
const ADMIN_TOKEN = 'admin-test-token';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          data: responseData ? JSON.parse(responseData) : null
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function testAdminScoreEditing() {
  console.log('🧪 Testing Admin Score Editing Feature\n');
  
  try {
    // Test 1: Get team evaluations
    console.log('Test 1: Fetching team evaluations for team ID 1...');
    const teamsResponse = await makeRequest('GET', '/api/admin/team-evaluations/1');
    console.log('Status:', teamsResponse.status);
    if (teamsResponse.data?.evaluations) {
      console.log(`✓ Found ${teamsResponse.data.evaluations.length} evaluations\n`);
      
      // Get first score ID if available
      if (teamsResponse.data.evaluations[0]?.scores[0]) {
        const firstScore = teamsResponse.data.evaluations[0].scores[0];
        console.log('First Score Details:');
        console.log('  Score ID:', firstScore.score_id);
        console.log('  Criterion:', firstScore.criterion_name);
        console.log('  Current Score:', firstScore.score);
        console.log('  Weight:', firstScore.weight);
        console.log('  Admin Note:', firstScore.admin_note || 'None\n');
        
        // Test 2: Update the score
        console.log('Test 2: Updating score...');
        const newScore = 8.5;
        const updateResponse = await makeRequest('PUT', `/api/admin/evaluation-scores/${firstScore.score_id}`, {
          score: newScore,
          adminNote: 'تعديل تجريبي من الاختبار - تصحيح خطأ في التقييم'
        });
        
        console.log('Status:', updateResponse.status);
        if (updateResponse.status === 200) {
          console.log('✓ Score updated successfully');
          console.log('Response:', JSON.stringify(updateResponse.data, null, 2));
        } else {
          console.log('✗ Failed to update score');
          console.log('Response:', JSON.stringify(updateResponse.data, null, 2));
        }
      } else {
        console.log('⚠ No scores available to test update\n');
      }
    } else {
      console.log('Response:', teamsResponse.data);
    }
  } catch (error) {
    console.error('Test Error:', error.message);
  }
}

// Run tests
testAdminScoreEditing().then(() => {
  console.log('\n✅ Tests completed');
  process.exit(0);
}).catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
