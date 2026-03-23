/**
 * Plans API Routes Test
 *
 * This is a simple manual test file to verify the plans API endpoints.
 * Run with: node test/plans.test.js
 *
 * Prerequisites: Server must be running on http://localhost:3000
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (err) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test functions
async function testGetActivePlan() {
  console.log('\n=== Test GET /api/plans/active ===');
  try {
    const result = await request('GET', '/api/plans/active');
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));

    if (result.status === 200 && result.data.success) {
      console.log('✅ GET /api/plans/active PASSED');
      return true;
    } else {
      console.log('❌ GET /api/plans/active FAILED');
      return false;
    }
  } catch (err) {
    console.log('❌ GET /api/plans/active ERROR:', err.message);
    return false;
  }
}

async function testCreatePlanFromTemplate() {
  console.log('\n=== Test POST /api/plans/create-from-template ===');

  // Test with weekday template
  const weekStart = '2026-03-23'; // Monday
  const testData = {
    week_start: weekStart,
    template_type: 'weekday'
  };

  try {
    const result = await request('POST', '/api/plans/create-from-template', testData);
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));

    if (result.status === 200 && result.data.success) {
      console.log('✅ POST /api/plans/create-from-template PASSED');
      console.log(`   Created plan ID: ${result.data.data.plan_id}`);
      console.log(`   Tasks created: ${result.data.data.tasks_created}`);
      return true;
    } else {
      console.log('❌ POST /api/plans/create-from-template FAILED');
      return false;
    }
  } catch (err) {
    console.log('❌ POST /api/plans/create-from-template ERROR:', err.message);
    return false;
  }
}

async function testValidationErrors() {
  console.log('\n=== Test Validation Errors ===');

  // Test missing parameters
  console.log('\nTest 1: Missing week_start');
  try {
    const result = await request('POST', '/api/plans/create-from-template', {
      template_type: 'weekday'
    });
    if (result.status === 400 && !result.data.success) {
      console.log('✅ Validation error for missing week_start');
    } else {
      console.log('❌ Should return 400 for missing week_start');
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
  }

  // Test invalid template type
  console.log('\nTest 2: Invalid template_type');
  try {
    const result = await request('POST', '/api/plans/create-from-template', {
      week_start: '2026-03-23',
      template_type: 'invalid'
    });
    if (result.status === 400 && !result.data.success) {
      console.log('✅ Validation error for invalid template_type');
    } else {
      console.log('❌ Should return 400 for invalid template_type');
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
  }
}

async function testDateHandling() {
  console.log('\n=== Test Date Handling ===');
  console.log('Testing that dates are calculated correctly in local timezone...');

  // The plan created on 2026-03-23 (Monday) should have tasks for Mon-Fri
  const expectedDates = {
    'Mon': '2026-03-23',
    'Tue': '2026-03-24',
    'Wed': '2026-03-25',
    'Thu': '2026-03-26',
    'Fri': '2026-03-27'
  };

  console.log('Expected dates for week starting 2026-03-23:');
  Object.entries(expectedDates).forEach(([day, date]) => {
    console.log(`  ${day}: ${date}`);
  });

  try {
    const result = await request('GET', '/api/plans/active');
    if (result.data.success && result.data.data.tasks) {
      const tasks = result.data.data.tasks;
      console.log(`\nActual tasks created: ${tasks.length}`);

      // Check a sample task
      if (tasks.length > 0) {
        const sampleTask = tasks[0];
        console.log(`\nSample task:`);
        console.log(`  Title: ${sampleTask.title}`);
        console.log(`  Date: ${sampleTask.date}`);
        console.log(`  Day of week: ${sampleTask.day_of_week}`);

        const expectedDate = expectedDates[sampleTask.day_of_week];
        if (sampleTask.date === expectedDate) {
          console.log('  ✅ Date matches expected value');
          return true;
        } else {
          console.log(`  ❌ Date mismatch! Expected: ${expectedDate}`);
          return false;
        }
      }
    }
  } catch (err) {
    console.log('❌ ERROR:', err.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('='.repeat(50));
  console.log('Plans API Routes Test Suite');
  console.log('='.repeat(50));
  console.log('\n⚠️  Make sure the server is running on http://localhost:3000');
  console.log('   Start it with: npm start\n');

  // Give user time to read the warning
  await new Promise(resolve => setTimeout(resolve, 2000));

  const results = [];

  // Test 1: Get active plan (should return empty initially)
  results.push(await testGetActivePlan());

  // Test 2: Create plan from template
  results.push(await testCreatePlanFromTemplate());

  // Test 3: Verify plan was created
  results.push(await testGetActivePlan());

  // Test 4: Validation errors
  await testValidationErrors();

  // Test 5: Date handling
  results.push(await testDateHandling());

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Test Summary');
  console.log('='.repeat(50));
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
