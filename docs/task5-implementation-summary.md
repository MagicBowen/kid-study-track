# Task 5: Plans API Routes - Implementation Summary

## Status: ✅ DONE

**Implementation Date:** 2026-03-23
**Commit:** `301ca67`
**Test Results:** All tests passing (4/4)

## What Was Implemented

### 1. Core API Endpoints

#### GET `/api/plans/active`
- Retrieves the currently active plan with all associated tasks
- Returns empty result if no active plan exists
- Includes task details with day_of_week mapping
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "id": 1,
      "name": "周内标准计划",
      "type": "weekday",
      "week_start": "2026-03-23",
      "is_active": 1,
      "tasks": [...]
    }
  }
  ```

#### POST `/api/plans/create-from-template`
- Creates a new plan from predefined templates
- Validates required parameters (week_start, template_type)
- Deactivates all other plans (ensures only one active plan)
- Creates tasks for each day specified in template
- **Request Format:**
  ```json
  {
    "week_start": "2026-03-23",
    "template_type": "weekday"  // or "weekend"
  }
  ```
- **Response Format:**
  ```json
  {
    "success": true,
    "data": {
      "plan_id": 1,
      "tasks_created": 35,
      "week_start": "2026-03-23"
    }
  }
  ```

### 2. Default Templates

#### Weekday Template (周内标准计划)
- **7 subjects** × **5 days** (Mon-Fri) = **35 tasks**
- Subjects: 数学, 物理, 化学, 生物, 语文, 英语 (2 types)
- Tasks per day:
  1. 数学 - 《练到位》练习
  2. 物理 - 《必刷题》练习
  3. 化学 - 《每日一题》
  4. 生物 - 《必刷题》练习
  5. 语文 - 《高考真题》练习
  6. 英语 - 《语法填空》2篇
  7. 英语 - 《每日一句》+单词

#### Weekend Template (周末复习计划)
- **8 tasks** × **2 days** (Sat-Sun) = **16 tasks**
- Focus on review and consolidation:
  1. 数学 - 错题整理与复习
  2. 数学 - 学而思课后练习
  3. 物理 - 错题整理与复习
  4. 物理 - 学而思课后练习
  5. 化学 - 错题整理与复习
  6. 生物 - 错题整理与复习
  7. 语文 - 读书、整理思维导图、复述
  8. 英语 - 《语法填空》错题复习

### 3. Key Features Implemented

#### Date Handling Fix
**Problem:** Using `toISOString().split('T')[0]` converts to UTC, causing timezone offsets.

**Solution:** Implemented local timezone formatting:
```javascript
function getTaskDate(weekStart, dayOfWeek) {
  const weekMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const date = new Date(weekStart);
  const targetDay = weekMap[dayOfWeek];
  const currentDay = date.getDay();
  const diff = targetDay - (currentDay === 0 ? 7 : currentDay);
  date.setDate(date.getDate() + diff);

  // Use local timezone formatting
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

#### Input Validation
- Validates presence of `week_start` and `template_type`
- Validates `template_type` against available templates
- Returns proper error responses:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "缺少必要参数"
    }
  }
  ```

#### Single Active Plan Enforcement
- When creating a new plan, all other plans are deactivated
- Ensures data consistency
- Prevents confusion about which plan is current

### 4. Testing

#### Test Coverage (`test/plans.test.js`)
1. ✅ GET `/api/plans/active` - Empty state
2. ✅ POST `/api/plans/create-from-template` - Weekday template
3. ✅ GET `/api/plans/active` - With populated data
4. ✅ Validation errors - Missing parameters
5. ✅ Validation errors - Invalid template type
6. ✅ Date handling - Local timezone accuracy

#### Test Results
```
Passed: 4/4
✅ All tests passed!
```

### 5. Database Integration

#### Tables Used
- **plans**: Stores plan metadata
- **tasks**: Stores individual task records
- **plan_tasks**: Links plans to tasks with day_of_week and sort_order

#### Data Creation Flow
1. Insert new plan record with `is_active = 1`
2. For each task in template:
   - Calculate date using `getTaskDate()`
   - Insert task record
   - Insert plan_tasks linkage with sort_order
3. Update all other plans to `is_active = 0`

## Files Created/Modified

### Created
- `/Users/wangbo/Docs/kids/src/routes/plans.js` - Main implementation (169 lines)
- `/Users/wangbo/Docs/kids/test/plans.test.js` - Test suite (184 lines)

### Modified
- None (replaced placeholder file)

## API Usage Examples

### Example 1: Create Weekday Plan
```bash
curl -X POST http://localhost:3000/api/plans/create-from-template \
  -H "Content-Type: application/json" \
  -d '{
    "week_start": "2026-03-23",
    "template_type": "weekday"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan_id": 1,
    "tasks_created": 35,
    "week_start": "2026-03-23"
  }
}
```

### Example 2: Get Active Plan
```bash
curl http://localhost:3000/api/plans/active
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "周内标准计划",
    "type": "weekday",
    "week_start": "2026-03-23",
    "is_active": 1,
    "tasks": [
      {
        "id": 2,
        "title": "《练到位》练习",
        "subject": "数学",
        "date": "2026-03-23",
        "day_of_week": "Mon",
        ...
      }
    ]
  }
}
```

## Next Steps

Task 5 is complete. The next tasks in the implementation plan are:
- Task 6: 统计 API 路由 (Statistics API routes)
- Task 7: PDF 导出 API (PDF export API)
- Tasks 8-14: Frontend implementation

## Notes

- Implementation follows TDD principles with comprehensive test coverage
- Date handling fix prevents UTC timezone conversion issues
- Single active plan enforcement ensures data consistency
- Template system allows easy extension for new plan types
- All validation and error handling in place
