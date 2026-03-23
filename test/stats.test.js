/**
 * Statistics API Routes Test
 *
 * This is a simple manual test file to verify the statistics API endpoints.
 * Run with: node test/stats.test.js
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
async function testGetWeekStats() {
  console.log('\n=== Test GET /api/stats/week ===');
  try {
    const weekStart = '2026-03-23'; // Monday
    const result = await request('GET', `/api/stats/week?weekStart=${weekStart}`);
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));

    if (result.status === 200 && result.data.success) {
      const data = result.data.data;
      console.log('\n📊 Weekly Statistics:');
      console.log(`  Total Hours: ${data.total_hours}`);
      console.log(`  Daily Average: ${data.daily_average}`);
      console.log(`  Completion Rate: ${data.completion_rate}%`);
      console.log(`  Total Tasks: ${data.total_tasks}`);
      console.log(`  Completed Tasks: ${data.completed_tasks}`);

      if (data.by_subject && data.by_subject.length > 0) {
        console.log('\n  By Subject:');
        data.by_subject.forEach(subject => {
          console.log(`    ${subject.subject}: ${subject.totalHours}h (${subject.completed}/${subject.total} tasks)`);
        });
      }

      if (data.daily_trend && data.daily_trend.length > 0) {
        console.log('\n  Daily Trend:');
        data.daily_trend.forEach(day => {
          console.log(`    ${day.date}: ${day.hours}h (${day.completed}/${day.total} tasks)`);
        });
      }

      console.log('✅ GET /api/stats/week PASSED');
      return true;
    } else {
      console.log('❌ GET /api/stats/week FAILED');
      return false;
    }
  } catch (err) {
    console.log('❌ GET /api/stats/week ERROR:', err.message);
    return false;
  }
}

async function testGetWeekStatsMissingParam() {
  console.log('\n=== Test GET /api/stats/week (missing weekStart) ===');
  try {
    const result = await request('GET', '/api/stats/week');
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));

    if (result.status === 400 && !result.data.success) {
      console.log('✅ GET /api/stats/week (missing param) PASSED');
      return true;
    } else {
      console.log('❌ GET /api/stats/week (missing param) FAILED');
      return false;
    }
  } catch (err) {
    console.log('❌ GET /api/stats/week (missing param) ERROR:', err.message);
    return false;
  }
}

async function testGetSubjectStats() {
  console.log('\n=== Test GET /api/stats/subject ===');
  try {
    const subject = '数学';
    const weekStart = '2026-03-23';
    const result = await request('GET', `/api/stats/subject?subject=${encodeURIComponent(subject)}&weekStart=${weekStart}`);
    console.log('Status:', result.status);
    console.log('Response:', JSON.stringify(result.data, null, 2));

    if (result.status === 200 && result.data.success) {
      const data = result.data.data;
      console.log('\n📚 Subject Statistics:');
      console.log(`  Subject: ${data.subject}`);
      console.log(`  Total Hours: ${data.totalHours}`);
      console.log(`  Task Count: ${data.taskCount}`);
      console.log(`  Completed Count: ${data.completedCount}`);
      console.log(`  Completion Rate: ${data.completionRate}%`);

      if (data.dailyDetails && data.dailyDetails.length > 0) {
        console.log('\n  Daily Details:');
        data.dailyDetails.forEach(day => {
          if (day.tasks.length > 0) {
            console.log(`    ${day.date}:`);
            day.tasks.forEach(task => {
              console.log(`      - ${task.title} (${task.completed ? '✓' : '✗'}) ${task.timeSpent}min`);
            });
          }
        });
      }

      console.log('✅ GET /api/stats/subject PASSED');
      return true;
    } else {
      console.log('❌ GET /api/stats/subject FAILED');
      return false;
    }
  } catch (err) {
    console.log('❌ GET /api/stats/subject ERROR:', err.message);
    return false;
  }
}

async function testGetSubjectStatsMissingParams() {
  console.log('\n=== Test GET /api/stats/subject (missing params) ===');
  try {
    // Missing subject
    const result1 = await request('GET', '/api/stats/subject?weekStart=2026-03-23');
    console.log('Test 1 - Missing subject:');
    console.log('Status:', result1.status);
    console.log('Response:', JSON.stringify(result1.data, null, 2));

    // Missing weekStart
    const result2 = await request('GET', '/api/stats/subject?subject=数学');
    console.log('\nTest 2 - Missing weekStart:');
    console.log('Status:', result2.status);
    console.log('Response:', JSON.stringify(result2.data, null, 2));

    if (result1.status === 400 && result2.status === 400) {
      console.log('✅ GET /api/stats/subject (missing params) PASSED');
      return true;
    } else {
      console.log('❌ GET /api/stats/subject (missing params) FAILED');
      return false;
    }
  } catch (err) {
    console.log('❌ GET /api/stats/subject (missing params) ERROR:', err.message);
    return false;
  }
}

async function testGetWeekDatesHelper() {
  console.log('\n=== Test getWeekDates Helper Function ===');
  try {
    // This test verifies the date handling logic works correctly
    // We'll test this by calling the API and checking the response
    const weekStart = '2026-03-23';
    const result = await request('GET', `/api/stats/week?weekStart=${weekStart}`);

    if (result.status === 200 && result.data.success && result.data.data.daily_trend) {
      const dates = result.data.data.daily_trend.map(d => d.date);

      // Expected dates for week starting 2026-03-23
      const expectedDates = [
        '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26',
        '2026-03-27', '2026-03-28', '2026-03-29'
      ];

      console.log('Expected dates:', expectedDates);
      console.log('Actual dates:', dates);

      const datesMatch = JSON.stringify(dates) === JSON.stringify(expectedDates);

      if (datesMatch) {
        console.log('✅ getWeekDates Helper PASSED (dates match expected)');
        return true;
      } else {
        console.log('❌ getWeekDates Helper FAILED (dates do not match)');
        return false;
      }
    } else {
      console.log('❌ getWeekDates Helper FAILED (invalid API response)');
      return false;
    }
  } catch (err) {
    console.log('❌ getWeekDates Helper ERROR:', err.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Statistics API Routes Test Suite        ║');
  console.log('╚══════════════════════════════════════════╝');

  const results = [];

  results.push(await testGetWeekStatsMissingParam());
  results.push(await testGetWeekStats());
  results.push(await testGetWeekDatesHelper());
  results.push(await testGetSubjectStatsMissingParams());
  results.push(await testGetSubjectStats());

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Test Results Summary                    ║');
  console.log('╚══════════════════════════════════════════╝');
  const passed = results.filter(r => r).length;
  const total = results.length;
  console.log(`Passed: ${passed}/${total}`);

  if (passed === total) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log(`\n❌ ${total - passed} test(s) failed`);
  }
}

// Run tests
runAllTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
