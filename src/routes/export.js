const express = require('express');
const router = express.Router();
const database = require('../database');

// GET /api/export/print?weekStart=YYYY-MM-DD - Generate print-friendly HTML
router.get('/print', async (req, res, next) => {
  try {
    const { weekStart } = req.query;

    // Validate weekStart parameter
    if (!weekStart) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 weekStart 参数' }
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(weekStart)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'weekStart 格式无效，应为 YYYY-MM-DD' }
      });
    }

    // Verify it's a valid date
    const testDate = new Date(weekStart);
    if (isNaN(testDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'weekStart 不是有效日期' }
      });
    }

    // Get plan data (for specified week or active plan)
    const plan = await database.get(
      'SELECT * FROM plans WHERE week_start = ? OR is_active = 1 ORDER BY is_active DESC LIMIT 1',
      [weekStart]
    );

    // Calculate week date range
    const weekDates = [];
    const startDate = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      weekDates.push(`${year}-${month}-${day}`);
    }

    // Get ALL tasks for this week (not just plan-linked tasks)
    const placeholders = weekDates.map(() => '?').join(',');
    const allTasks = await database.all(
      `SELECT t.* FROM tasks t WHERE t.date IN (${placeholders}) ORDER BY t.subject, t.title`,
      weekDates
    );

    // Generate HTML template with all tasks
    const html = generatePrintTemplate(plan, allTasks, weekStart);

    // Set response headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);

  } catch (err) {
    next(err);
  }
});

/**
 * Generate HTML template for print/export
 * Creates a weekly tracking table with checkboxes only on days where task exists
 */
function generatePrintTemplate(plan, tasks, weekStart) {
  // Calculate week dates
  const weekDates = [];
  const startDate = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    weekDates.push(`${year}-${month}-${day}`);
  }

  // Group tasks by subject and title, track which days they exist on
  const bySubjectTitle = {};
  tasks.forEach(task => {
    const key = `${task.subject}|${task.title}`;
    if (!bySubjectTitle[key]) {
      bySubjectTitle[key] = {
        subject: task.subject,
        title: task.title,
        dates: []
      };
    }
    if (!bySubjectTitle[key].dates.includes(task.date)) {
      bySubjectTitle[key].dates.push(task.date);
    }
  });

  // Subject colors
  const colors = {
    '数学': '#e67e00',
    '物理': '#1a6fb5',
    '化学': '#b03020',
    '生物': '#1e8449',
    '语文': '#7d3c98',
    '英语': '#1a252f',
    '运动': '#c0392b'
  };

  // Generate table rows
  let tableRows = '';

  // If we have tasks, render them with checkboxes only on their assigned days
  if (Object.keys(bySubjectTitle).length > 0) {
    for (const [key, taskInfo] of Object.entries(bySubjectTitle)) {
      const color = colors[taskInfo.subject] || '#666';

      tableRows += `
        <tr>
          <td style="background: ${color}; color: white; padding: 4px; text-align: center; font-weight: bold;">${taskInfo.subject}</td>
          <td style="padding: 4px; font-size: 9px;">${taskInfo.title}</td>
          ${weekDates.map(date => {
            const hasTaskOnDay = taskInfo.dates.includes(date);
            if (hasTaskOnDay) {
              // Task exists on this day - show checkbox and input
              return `
                <td style="padding: 2px; text-align: center;">
                  <div style="border: 1px solid #999; width: 14px; height: 14px; margin: 0 auto;"></div>
                  <div style="border-bottom: 1px solid #999; width: 30px; height: 12px; margin: 2px auto;"></div>
                </td>
              `;
            } else {
              // No task on this day - show disabled/hatched pattern
              return `
                <td style="padding: 2px; text-align: center; background: repeating-linear-gradient(
                  45deg,
                  #f5f5f5,
                  #f5f5f5 2px,
                  #e8e8e8 2px,
                  #e8e8e8 4px
                );">
                  <div style="color: #ccc; font-size: 10px;">—</div>
                </td>
              `;
            }
          }).join('')}
          <td style="padding: 4px;"></td>
        </tr>
      `;
    }
  }

  // Calculate display dates for header
  const displayDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    displayDates.push(`${date.getMonth() + 1}/${date.getDate()}`);
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
      font-size: 9px;
      margin: 0;
      padding: 10mm;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #999;
      padding: 3px;
    }
    th {
      background: #34495e;
      color: white;
      font-size: 8px;
      font-weight: bold;
      text-align: center;
      padding: 4px;
    }
    .header {
      text-align: center;
      margin-bottom: 15px;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      color: #2c3e50;
    }
    .week-info {
      margin: 8px 0;
      font-size: 10px;
      color: #555;
    }
    .week-input {
      display: inline-block;
      border-bottom: 1px solid #999;
      width: 50px;
      margin: 0 4px;
    }
    .instructions {
      margin-top: 12px;
      font-size: 8px;
      color: #666;
      background: #f9f9f9;
      padding: 8px;
      border-radius: 4px;
    }
    .checkbox {
      border: 1px solid #999;
      width: 14px;
      height: 14px;
      margin: 0 auto;
    }
    .time-input {
      border-bottom: 1px solid #999;
      width: 30px;
      height: 12px;
      margin: 2px auto;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📚 高一课外学习 · 每周计划跟踪表</h1>
    <div class="week-info">
      第 <span class="week-input"></span> 周 |
      ${weekDates[0]} (周一) ~ ${weekDates[6]} (周日)
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 8%;">科目</th>
        <th style="width: 35%;">任务内容</th>
        <th>周一<br><small>${weekDates[0]}</small></th>
        <th>周二<br><small>${weekDates[1]}</small></th>
        <th>周三<br><small>${weekDates[2]}</small></th>
        <th>周四<br><small>${weekDates[3]}</small></th>
        <th>周五<br><small>${weekDates[4]}</small></th>
        <th>周六<br><small>${weekDates[5]}</small></th>
        <th>周日<br><small>${weekDates[6]}</small></th>
        <th style="width: 10%;">备注</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div class="instructions">
    💡 <strong>使用说明：</strong>
    每完成一项任务，在方格中打 ✓，横线上填写用时（分钟）。
    备注栏可记录学习内容、难点、错题等信息。
  </div>

  <script>
    // Trigger print dialog when page loads
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;
}

module.exports = router;
