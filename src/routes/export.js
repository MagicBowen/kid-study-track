const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const database = require('../database');

// GET /api/export/pdf?weekStart=YYYY-MM-DD - Generate and download PDF
router.get('/pdf', async (req, res, next) => {
  let browser;
  try {
    // Set request timeout (30 seconds)
    req.setTimeout(30000);

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

    // If no plan found, create a generic template
    const tasks = plan ? await database.all(
      `SELECT t.*, pt.day_of_week
       FROM tasks t
       JOIN plan_tasks pt ON t.id = pt.task_id
       WHERE pt.plan_id = ?
       ORDER BY pt.sort_order`,
      [plan.id]
    ) : [];

    // Generate HTML template
    const html = generatePDFTemplate(plan, tasks, weekStart);

    // Launch Puppeteer and generate PDF
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Add this for macOS compatibility
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 10000 });

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: {
        top: '10mm',
        right: '10mm',
        bottom: '10mm',
        left: '10mm'
      }
    });

    await browser.close();

    // Set response headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-tracker-${weekStart}.pdf"`);
    res.setHeader('Content-Length', pdf.length);
    res.send(pdf);

  } catch (err) {
    // Ensure browser is closed on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('[ERROR] Failed to close browser:', closeErr);
      }
    }
    next(err);
  }
});

/**
 * Generate HTML template for PDF export
 * Creates a blank weekly tracking table with empty checkboxes and input fields
 */
function generatePDFTemplate(plan, tasks, weekStart) {
  // Group tasks by subject
  const bySubject = {};
  tasks.forEach(task => {
    if (!bySubject[task.subject]) {
      bySubject[task.subject] = [];
    }
    bySubject[task.subject].push(task);
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

  // If we have tasks, group them by subject
  if (Object.keys(bySubject).length > 0) {
    for (const [subject, subjectTasks] of Object.entries(bySubject)) {
      const color = colors[subject] || '#666';
      subjectTasks.forEach(task => {
        tableRows += `
          <tr>
            <td style="background: ${color}; color: white; padding: 4px; text-align: center; font-weight: bold;">${subject}</td>
            <td style="padding: 4px; font-size: 9px;">${task.title}</td>
            ${['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(() => `
              <td style="padding: 2px; text-align: center;">
                <div style="border: 1px solid #999; width: 14px; height: 14px; margin: 0 auto;"></div>
                <div style="border-bottom: 1px solid #999; width: 30px; height: 12px; margin: 2px auto;"></div>
              </td>
            `).join('')}
            <td style="padding: 4px;"></td>
          </tr>
        `;
      });
    }
  } else {
    // Generate empty template rows for all subjects
    const defaultSubjects = ['数学', '物理', '化学', '生物', '语文', '英语'];
    defaultSubjects.forEach(subject => {
      const color = colors[subject] || '#666';
      // Add 2 rows per subject
      for (let i = 0; i < 2; i++) {
        tableRows += `
          <tr>
            <td style="background: ${color}; color: white; padding: 4px; text-align: center; font-weight: bold;">${subject}</td>
            <td style="padding: 4px;"></td>
            ${['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(() => `
              <td style="padding: 2px; text-align: center;">
                <div style="border: 1px solid #999; width: 14px; height: 14px; margin: 0 auto;"></div>
                <div style="border-bottom: 1px solid #999; width: 30px; height: 12px; margin: 2px auto;"></div>
              </td>
            `).join('')}
            <td style="padding: 4px;"></td>
          </tr>
        `;
      }
    });
  }

  // Calculate week dates
  const weekDates = [];
  const startDate = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    weekDates.push(`${date.getMonth() + 1}/${date.getDate()}`);
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
</body>
</html>
  `;
}

module.exports = router;
