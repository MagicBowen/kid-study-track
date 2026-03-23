# 高中生课外任务进度跟踪打卡系统 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个在线任务跟踪和打卡系统，帮助高中学生和家长协同管理课外学习任务

**Architecture:** 单体 Express 服务器 + SQLite 数据库 + 原生 JavaScript 前端。服务器提供静态文件和 REST API，前端通过 API 与数据库交互，支持学生/家长双视图切换。

**Tech Stack:** Node.js, Express, SQLite3, Puppeteer, Vanilla JavaScript

---

## 文件结构映射

### 后端文件
| 文件 | 职责 |
|------|------|
| `package.json` | 项目依赖和脚本配置 |
| `config.json` | 应用配置（端口、数据库路径等） |
| `start.sh` | 一键启动脚本 |
| `src/server.js` | Express 服务器入口，路由配置 |
| `src/database.js` | SQLite 数据库初始化和连接管理 |
| `src/routes/tasks.js` | 任务 CRUD API 路由 |
| `src/routes/plans.js` | 计划管理 API 路由 |
| `src/routes/stats.js` | 统计数据 API 路由 |
| `src/routes/export.js` | PDF 导出 API 路由 |

### 前端文件
| 文件 | 职责 |
|------|------|
| `src/public/index.html` | 主页面，包含学生/家长视图切换 |
| `src/public/css/style.css` | 全局样式，科目颜色定义 |
| `src/public/js/api.js` | API 请求封装，错误处理 |
| `src/public/js/state.js` | 客户端状态管理 |
| `src/public/js/student.js` | 学生视图逻辑 |
| `src/public/js/parent.js` | 家长视图逻辑 |
| `src/public/js/utils.js` | 工具函数（日期处理、时间计算） |

---

## Task 1: 项目初始化和配置

**Files:**
- Create: `package.json`
- Create: `config.json`
- Create: `.gitignore`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "study-tracker",
  "version": "1.0.0",
  "description": "高中生课外任务进度跟踪打卡系统",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "init-db": "node src/database.js init",
    "test": "echo \"Tests not yet implemented\""
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "puppeteer": "^21.0.0",
    "body-parser": "^1.20.2"
  },
  "devDependencies": {}
}
```

- [ ] **Step 2: 创建 config.json**

```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "database": {
    "path": "./data/tasks.db",
    "backupPath": "./data/backups"
  },
  "pdf": {
    "format": "A4",
    "orientation": "landscape"
  }
}
```

- [ ] **Step 3: 创建 .gitignore**

```
node_modules/
data/*.db
data/backups/
uploads/
*.log
.DS_Store
.superpowers/
```

- [ ] **Step 4: 安装依赖**

Run: `npm install`
Expected: `node_modules/` 目录创建完成

- [ ] **Step 5: 提交**

```bash
git add package.json config.json .gitignore
git commit -m "feat: initialize project configuration"
```

---

## Task 2: 数据库层实现

**Files:**
- Create: `src/database.js`

- [ ] **Step 1: 创建数据库模块框架**

```javascript
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const config = require('../config.json');

class Database {
  constructor() {
    this.db = null;
  }

  async initialize() {
    // 确保数据目录存在
    const dbDir = path.dirname(config.database.path);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 确保备份目录存在
    if (!fs.existsSync(config.database.backupPath)) {
      fs.mkdirSync(config.database.backupPath, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(config.database.path, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async createTables() {
    const tables = [
      // tasks 表
      `CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subject TEXT,
        type TEXT,
        plan_id INTEGER,
        date TEXT,
        is_completed BOOLEAN DEFAULT 0,
        start_time TEXT,
        end_time TEXT,
        time_spent INTEGER DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (plan_id) REFERENCES plans(id)
      )`,

      // plans 表
      `CREATE TABLE IF NOT EXISTS plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT,
        week_start TEXT,
        is_active BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // plan_tasks 表
      `CREATE TABLE IF NOT EXISTS plan_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plan_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        day_of_week TEXT,
        sort_order INTEGER,
        FOREIGN KEY (plan_id) REFERENCES plans(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )`,

      // activity_logs 表
      `CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        user_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // schema_migrations 表
      `CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = new Database();
```

- [ ] **Step 2: 提交**

```bash
git add src/database.js
git commit -m "feat: add database layer with SQLite"
```

---

## Task 3: Express 服务器入口

**Files:**
- Create: `src/server.js`

- [ ] **Step 1: 创建 Express 服务器**

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('../config.json');
const database = require('./database');

const app = express();
const PORT = config.server.port;

// 中间件
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API 路由
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/export', require('./routes/export'));

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  const status = err.status || 500;
  const code = err.code || 'UNKNOWN_ERROR';

  res.status(status).json({
    success: false,
    error: {
      code: code,
      message: err.message || '服务器错误'
    }
  });
});

// 启动服务器
async function start() {
  try {
    await database.initialize();
    await database.createTables();
    console.log('✅ Database initialized');

    app.listen(PORT, config.server.host, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`📚 Student view: http://localhost:${PORT}`);
      console.log(`👁️  Parent view: http://localhost:${PORT}#parent`);
    });
  } catch (err) {
    console.error('❌ Failed to start:', err);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await database.close();
  process.exit(0);
});

start();
```

- [ ] **Step 2: 提交**

```bash
git add src/server.js
git commit -m "feat: add Express server entry point"
```

---

## Task 4: 任务 API 路由

**Files:**
- Create: `src/routes/tasks.js`

- [ ] **Step 1: 创建任务 API 路由**

```javascript
const express = require('express');
const router = express.Router();
const database = require('../database');

// GET /api/tasks?date=YYYY-MM-DD - 获取指定日期的任务
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 date 参数' }
      });
    }

    const tasks = await database.all(
      `SELECT id, title, subject, type, is_completed,
              start_time, end_time, time_spent, notes
       FROM tasks WHERE date = ? ORDER BY id`,
      [date]
    );

    res.json({ success: true, data: { date, tasks } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id - 更新任务
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_completed, start_time, end_time, notes } = req.body;

    // 计算用时
    let time_spent = 0;
    if (start_time && end_time) {
      const [startH, startM] = start_time.split(':').map(Number);
      const [endH, endM] = end_time.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (endMinutes < startMinutes) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIME_RANGE', message: '结束时间必须晚于开始时间' }
        });
      }

      time_spent = endMinutes - startMinutes;
    }

    // 更新任务
    await database.run(
      `UPDATE tasks SET is_completed = ?, start_time = ?, end_time = ?,
                      time_spent = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [is_completed ? 1 : 0, start_time, end_time, time_spent, notes, id]
    );

    res.json({
      success: true,
      data: { id: parseInt(id), is_completed, time_spent }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/complete - 标记任务完成
router.post('/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;

    await database.run(
      'UPDATE tasks SET is_completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    res.json({ success: true, data: { id: parseInt(id), is_completed: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add src/routes/tasks.js
git commit -m "feat: add tasks API routes"
```

---

## Task 5: 计划 API 路由

**Files:**
- Create: `src/routes/plans.js`

- [ ] **Step 1: 创建计划 API 路由**

```javascript
const express = require('express');
const router = express.Router();
const database = require('../database');

// 默认计划模板
const DEFAULT_TEMPLATES = {
  weekday: {
    name: "周内标准计划",
    type: "weekday",
    tasks: [
      { subject: "数学", title: "《练到位》练习", days: ["Mon","Tue","Wed","Thu","Fri"] },
      { subject: "物理", title: "《必刷题》练习", days: ["Mon","Tue","Wed","Thu","Fri"] },
      { subject: "化学", title: "《每日一题》", days: ["Mon","Tue","Wed","Thu","Fri"] },
      { subject: "生物", title: "《必刷题》练习", days: ["Mon","Tue","Wed","Thu","Fri"] },
      { subject: "语文", title: "《高考真题》练习", days: ["Mon","Tue","Wed","Thu","Fri"] },
      { subject: "英语", title: "《语法填空》2篇", days: ["Mon","Tue","Wed","Thu","Fri"] },
      { subject: "英语", title: "《每日一句》+单词", days: ["Mon","Tue","Wed","Thu","Fri"] }
    ]
  },
  weekend: {
    name: "周末复习计划",
    type: "weekend",
    tasks: [
      { subject: "数学", title: "错题整理与复习", days: ["Sat","Sun"] },
      { subject: "数学", title: "学而思课后练习", days: ["Sat","Sun"] },
      { subject: "物理", title: "错题整理与复习", days: ["Sat","Sun"] },
      { subject: "物理", title: "学而思课后练习", days: ["Sat","Sun"] },
      { subject: "化学", title: "错题整理与复习", days: ["Sat","Sun"] },
      { subject: "生物", title: "错题整理与复习", days: ["Sat","Sun"] },
      { subject: "语文", title: "读书、整理思维导图、复述", days: ["Sat","Sun"] },
      { subject: "英语", title: "《语法填空》错题复习", days: ["Sat","Sun"] }
    ]
  }
};

// GET /api/plans/active - 获取当前激活的计划
router.get('/active', async (req, res, next) => {
  try {
    const plan = await database.get(
      'SELECT * FROM plans WHERE is_active = 1 ORDER BY id DESC LIMIT 1'
    );

    if (!plan) {
      return res.json({ success: true, data: { id: null, tasks: [] } });
    }

    const tasks = await database.all(
      `SELECT t.*, pt.day_of_week
       FROM tasks t
       JOIN plan_tasks pt ON t.id = pt.task_id
       WHERE pt.plan_id = ?
       ORDER BY pt.sort_order`,
      [plan.id]
    );

    res.json({ success: true, data: { ...plan, tasks } });
  } catch (err) {
    next(err);
  }
});

// POST /api/plans/create-from-template - 从模板创建新周计划
router.post('/create-from-template', async (req, res, next) => {
  try {
    const { week_start, template_type } = req.body;

    if (!week_start || !template_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' }
      });
    }

    const template = DEFAULT_TEMPLATES[template_type];
    if (!template) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '无效的模板类型' }
      });
    }

    // 创建计划
    const planResult = await database.run(
      'INSERT INTO plans (name, type, week_start, is_active) VALUES (?, ?, ?, 1)',
      [template.name, template.type, week_start]
    );

    // 创建任务（使用当前周作为默认）
    const actualWeekStart = week_start || DateUtils.format(new Date());
    const taskPromises = [];

    for (const taskData of template.tasks) {
      for (const day of taskData.days) {
        taskPromises.push(
          (async () => {
            const taskDate = getTaskDate(actualWeekStart, day);
            const result = await database.run(
              'INSERT INTO tasks (title, subject, type, date, is_completed) VALUES (?, ?, ?, ?, 0)',
              [taskData.title, taskData.subject, template_type, taskDate]
            );
            await database.run(
              'INSERT INTO plan_tasks (plan_id, task_id, day_of_week) VALUES (?, ?, ?)',
              [planResult.id, result.id, day]
            );
          })()
        );
      }
    }

    await Promise.all(taskPromises);

    // 取消其他计划的激活状态
    await database.run('UPDATE plans SET is_active = 0 WHERE id != ?', [planResult.id]);

    res.json({
      success: true,
      data: { plan_id: planResult.id, tasks_created: taskPromises.length, week_start }
    });
  } catch (err) {
    next(err);
  }
});

// 根据周开始日期和星期几获取具体日期
function getTaskDate(weekStart, dayOfWeek) {
  const weekMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const date = new Date(weekStart);
  const targetDay = weekMap[dayOfWeek];
  const currentDay = date.getDay();
  const diff = targetDay - (currentDay === 0 ? 7 : currentDay);
  date.setDate(date.getDate() + diff);
  return date.toISOString().split('T')[0];
}

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add src/routes/plans.js
git commit -m "feat: add plans API routes with default templates"
```

---

## Task 6: 统计 API 路由

**Files:**
- Create: `src/routes/stats.js`

- [ ] **Step 1: 创建统计 API 路由**

```javascript
const express = require('express');
const router = express.Router();
const database = require('../database');

// GET /api/stats/week?weekStart=YYYY-MM-DD - 周统计
router.get('/week', async (req, res, next) => {
  try {
    const { weekStart } = req.query;

    if (!weekStart) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 weekStart 参数' }
      });
    }

    // 计算一周的日期范围
    const weekDates = getWeekDates(weekStart);

    // 获取所有任务
    const placeholders = weekDates.map(() => '?').join(',');
    const tasks = await database.all(
      `SELECT subject, is_completed, time_spent, date
       FROM tasks WHERE date IN (${placeholders})`,
      weekDates
    );

    // 计算统计数据
    const stats = calculateWeekStats(tasks, weekDates);

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/subject?subject=数学&weekStart=YYYY-MM-DD - 单科详情
router.get('/subject', async (req, res, next) => {
  try {
    const { subject, weekStart } = req.query;

    if (!subject || !weekStart) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' }
      });
    }

    const weekDates = getWeekDates(weekStart);
    const placeholders = weekDates.map(() => '?').join(',');

    const tasks = await database.all(
      `SELECT * FROM tasks
       WHERE subject = ? AND date IN (${placeholders})
       ORDER BY date`,
      [subject, ...weekDates]
    );

    // 计算单科统计
    const totalHours = tasks.reduce((sum, t) => sum + (t.time_spent || 0), 0) / 60;
    const completedCount = tasks.filter(t => t.is_completed).length;

    // 按日期分组
    const dailyDetails = weekDates.map(date => {
      const dayTasks = tasks.filter(t => t.date === date);
      return {
        date,
        tasks: dayTasks.map(t => ({
          title: t.title,
          completed: t.is_completed,
          timeSpent: t.time_spent,
          notes: t.notes
        }))
      };
    });

    res.json({
      success: true,
      data: {
        subject,
        totalHours: Math.round(totalHours * 10) / 10,
        taskCount: tasks.length,
        completedCount,
        completionRate: tasks.length > 0 ? Math.round(completedCount / tasks.length * 100) : 0,
        dailyDetails
      }
    });
  } catch (err) {
    next(err);
  }
});

function getWeekDates(weekStart) {
  const dates = [];
  const date = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    dates.push(date.toISOString().split('T')[0]);
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

function calculateWeekStats(tasks, weekDates) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);

  // 按科目统计
  const bySubject = {};
  tasks.forEach(task => {
    if (!bySubject[task.subject]) {
      bySubject[task.subject] = { totalHours: 0, completed: 0, total: 0 };
    }
    bySubject[task.subject].totalHours += (task.time_spent || 0) / 60;
    bySubject[task.subject].total++;
    if (task.is_completed) bySubject[task.subject].completed++;
  });

  // 转换为数组并计算百分比
  const subjectStats = Object.entries(bySubject).map(([subject, data]) => ({
    subject,
    totalHours: Math.round(data.totalHours * 10) / 10,
    completed: data.completed,
    total: data.total,
    percentage: Math.round((data.totalHours / (totalMinutes / 60)) * 100)
  }));

  // 每日趋势
  const dailyTrend = weekDates.map(date => {
    const dayTasks = tasks.filter(t => t.date === date);
    const hours = dayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0) / 60;
    return {
      date,
      hours: Math.round(hours * 10) / 10,
      completed: dayTasks.filter(t => t.is_completed).length,
      total: dayTasks.length
    };
  });

  return {
    total_hours: Math.round(totalMinutes / 60 * 10) / 10,
    daily_average: Math.round((totalMinutes / 60 / 7) * 10) / 10,
    completion_rate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0,
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    by_subject: subjectStats,
    daily_trend: dailyTrend
  };
}

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add src/routes/stats.js
git commit -m "feat: add statistics API routes"
```

---

## Task 7: PDF 导出 API

**Files:**
- Create: `src/routes/export.js`

- [ ] **Step 1: 创建 PDF 导出 API**

```javascript
const express = require('express');
const router = express.Router();
const puppeteer = require('puppeteer');
const database = require('../database');

// GET /api/export/pdf?weekStart=YYYY-MM-DD - 生成并下载PDF
router.get('/pdf', async (req, res, next) => {
  let browser;
  try {
    const { weekStart } = req.query;

    if (!weekStart) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 weekStart 参数' }
      });
    }

    // 获取计划数据
    const plan = await database.get(
      'SELECT * FROM plans WHERE week_start = ? OR is_active = 1 ORDER BY is_active DESC LIMIT 1',
      [weekStart]
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '未找到计划数据' }
      });
    }

    const tasks = await database.all(
      `SELECT t.*, pt.day_of_week
       FROM tasks t
       JOIN plan_tasks pt ON t.id = pt.task_id
       WHERE pt.plan_id = ?
       ORDER BY pt.sort_order`,
      [plan.id]
    );

    // 渲染HTML模板
    const html = generatePDFTemplate(plan, tasks, weekStart);

    // 使用Puppeteer生成PDF
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(html);

    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true
    });

    await browser.close();

    // 设置响应头
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-tracker-${weekStart}.pdf"`);
    res.send(pdf);
  } catch (err) {
    if (browser) await browser.close();
    next(err);
  }
});

function generatePDFTemplate(plan, tasks, weekStart) {
  // 按科目分组
  const bySubject = {};
  tasks.forEach(task => {
    if (!bySubject[task.subject]) {
      bySubject[task.subject] = [];
    }
    bySubject[task.subject].push(task);
  });

  // 科目颜色
  const colors = {
    '数学': '#e67e00', '物理': '#1a6fb5', '化学': '#b03020',
    '生物': '#1e8449', '语文': '#7d3c98', '英语': '#1a252f', '运动': '#c0392b'
  };

  // 生成表格行
  let tableRows = '';
  for (const [subject, subjectTasks] of Object.entries(bySubject)) {
    const color = colors[subject] || '#666';
    subjectTasks.forEach(task => {
      tableRows += `
        <tr>
          <td style="background: ${color}; color: white; padding: 4px; text-align: center;">${subject}</td>
          <td style="padding: 4px;">${task.title}</td>
          ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => `
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

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Microsoft YaHei', sans-serif; font-size: 9px; margin: 10mm; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #999; padding: 3px; }
    th { background: #34495e; color: white; font-size: 8px; }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 10px;">
    <h1 style="margin: 0;">📚 高一课外学习 · 每周计划跟踪表</h1>
    <p style="margin: 4px 0;">第 <span style="border-bottom: 1px solid #999; display: inline-block; width: 40px;"></span> 周</p>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 8%;">科目</th>
        <th style="width: 40%;">任务内容</th>
        <th>周一</th>
        <th>周二</th>
        <th>周三</th>
        <th>周四</th>
        <th>周五</th>
        <th>周六</th>
        <th>周日</th>
        <th style="width: 10%;">备注</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <div style="margin-top: 10px; font-size: 8px; color: #666;">
    💡 使用说明：每完成一项任务，在方格中打 ✓，横线上填写用时（分钟）。
  </div>
</body>
</html>
  `;
}

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add src/routes/export.js
git commit -m "feat: add PDF export API with Puppeteer"
```

---

## Task 8: 前端 - 工具函数

**Files:**
- Create: `src/public/js/utils.js`

- [ ] **Step 1: 创建工具函数模块**

```javascript
// 日期处理工具（使用本地时区，避免UTC转换问题）
const DateUtils = {
  // 获取周的周一日期
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return this.format(new Date(d.setDate(diff)));
  },

  // 格式化为 YYYY-MM-DD（使用本地时区）
  format(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取一周的日期数组
  getWeekDates(weekStart) {
    const dates = [];
    const date = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      dates.push(this.format(date));
      date.setDate(date.getDate() + 1);
    }
    return dates;
  },

  // 格式化日期显示
  formatDisplay(dateStr) {
    const date = new Date(dateStr);
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1}/${date.getDate()} ${days[date.getDay()]}`;
  },

  // 获取当前周的周一
  getCurrentWeekStart() {
    return this.getWeekStart(new Date());
  }
};

// 时间处理工具
const TimeUtils = {
  // 计算用时（分钟）
  calculateTimeSpent(startTime, endTime) {
    if (!startTime || !endTime) return 0;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // 跨午夜处理
    if (endMinutes < startMinutes) {
      return endMinutes + 24 * 60 - startMinutes;
    }

    return endMinutes - startMinutes;
  },

  // 格式化分钟为 "X小时Y分钟"
  formatMinutes(minutes) {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  },

  // 验证时间格式
  validateTime(timeStr) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
  }
};

// 科目配置
const SubjectConfig = {
  colors: {
    '数学': '#e67e00',
    '物理': '#1a6fb5',
    '化学': '#b03020',
    '生物': '#1e8449',
    '语文': '#7d3c98',
    '英语': '#1a252f',
    '运动': '#c0392b'
  },

  icons: {
    '数学': '📐',
    '物理': '⚛️',
    '化学': '🧪',
    '生物': '🧬',
    '语文': '📖',
    '英语': '📝',
    '运动': '🏃'
  },

  getColor(subject) {
    return this.colors[subject] || '#666';
  },

  getIcon(subject) {
    return this.icons[subject] || '📚';
  }
};

// Toast 提示
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideUp 0.3s ease-out;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/public/js/utils.js
git commit -m "feat: add frontend utility functions"
```

---

## Task 9: 前端 - API 封装

**Files:**
- Create: `src/public/js/api.js`

- [ ] **Step 1: 创建 API 封装模块**

```javascript
// API 基础 URL
const API_BASE = '/api';

// 通用请求函数
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || '请求失败');
    }

    return result.data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// 任务 API
const TaskAPI = {
  // 获取指定日期的任务
  async getByDate(date) {
    return apiRequest(`/tasks?date=${date}`);
  },

  // 更新任务
  async update(id, data) {
    return apiRequest(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 标记完成
  async complete(id) {
    return apiRequest(`/tasks/${id}/complete`, {
      method: 'POST'
    });
  }
};

// 计划 API
const PlanAPI = {
  // 获取当前激活的计划
  async getActive() {
    return apiRequest('/plans/active');
  },

  // 从模板创建计划
  async createFromTemplate(weekStart, templateType) {
    return apiRequest('/plans/create-from-template', {
      method: 'POST',
      body: JSON.stringify({ week_start: weekStart, template_type: templateType })
    });
  },

  // 复制上周计划
  async copyLastWeek() {
    // 简化实现：使用模板创建
    const today = new Date();
    const lastWeekStart = DateUtils.getWeekStart(
      new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    );
    return this.createFromTemplate(lastWeekStart, 'weekday');
  }
};

// 统计 API
const StatsAPI = {
  // 获取周统计
  async getWeek(weekStart) {
    return apiRequest(`/stats/week?weekStart=${weekStart}`);
  },

  // 获取单科详情
  async getSubject(subject, weekStart) {
    return apiRequest(`/stats/subject?subject=${subject}&weekStart=${weekStart}`);
  }
};

// PDF 导出 API
const ExportAPI = {
  // 导出周跟踪表 PDF
  async exportPDF(weekStart) {
    const url = `${API_BASE}/export/pdf?weekStart=${weekStart}`;
    window.open(url, '_blank');
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add src/public/js/api.js
git commit -m "feat: add API wrapper module"
```

---

## Task 10: 前端 - 状态管理

**Files:**
- Create: `src/public/js/state.js`

- [ ] **Step 1: 创建状态管理模块**

```javascript
// 应用状态
const AppState = {
  // 用户当前选择的视图
  currentView: 'student', // 'student' | 'parent'

  // 选中的日期
  selectedDate: DateUtils.format(new Date()),

  // 当前周数据
  currentWeek: {
    start: DateUtils.getWeekStart(new Date()),
    end: null,
    tasks: {} // 按 date 分组: { '2024-03-19': [...] }
  },

  // 缓存的统计数据
  statsCache: {
    weekStats: null,
    subjectDetails: {}
  },

  // 加载状态
  loading: false,

  // 设置选中日期
  setSelectedDate(date) {
    this.selectedDate = date;
    this.notifyListeners('date-changed');
  },

  // 获取当前周开始日期
  getWeekStart() {
    return DateUtils.getWeekStart(this.selectedDate);
  },

  // 加载指定日期的任务
  async loadTasksForDate(date) {
    this.loading = true;
    this.notifyListeners('loading-changed');

    try {
      const data = await TaskAPI.getByDate(date);
      this.currentWeek.tasks[date] = data.tasks;
      this.notifyListeners('tasks-loaded');
      return data.tasks;
    } catch (err) {
      console.error('Failed to load tasks:', err);
      throw err;
    } finally {
      this.loading = false;
      this.notifyListeners('loading-changed');
    }
  },

  // 加载周统计数据
  async loadWeekStats(weekStart) {
    this.loading = true;
    this.notifyListeners('loading-changed');

    try {
      const stats = await StatsAPI.getWeek(weekStart);
      this.statsCache.weekStats = stats;
      this.notifyListeners('stats-loaded');
      return stats;
    } catch (err) {
      console.error('Failed to load stats:', err);
      throw err;
    } finally {
      this.loading = false;
      this.notifyListeners('loading-changed');
    }
  },

  // 更新任务
  async updateTask(taskId, data) {
    try {
      const result = await TaskAPI.update(taskId, data);

      // 更新本地状态
      const dateTasks = this.currentWeek.tasks[this.selectedDate];
      if (dateTasks) {
        const task = dateTasks.find(t => t.id === taskId);
        if (task) {
          Object.assign(task, result);
        }
      }

      this.notifyListeners('task-updated');
      return result;
    } catch (err) {
      console.error('Failed to update task:', err);
      throw err;
    }
  },

  // 切换视图
  switchView(view) {
    this.currentView = view;
    this.notifyListeners('view-changed');
  },

  // 事件监听器
  listeners: [],
  on(event, callback) {
    this.listeners.push({ event, callback });
  },
  notifyListeners(event) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback());
  }
};
```

- [ ] **Step 2: 提交**

```bash
git add src/public/js/state.js
git commit -m "feat: add state management module"
```

---

## Task 11: 前端 - 主页面 HTML

**Files:**
- Create: `src/public/index.html`

- [ ] **Step 1: 创建主页面 HTML**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>学习计划跟踪系统</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <!-- 视图切换导航栏 -->
  <nav class="view-nav">
    <div class="nav-item active" data-view="student">
      📚 学生视图
    </div>
    <div class="nav-item" data-view="parent">
      👁️ 家长视图
    </div>
    <div class="nav-info" id="weekInfo"></div>
  </nav>

  <!-- 学生视图 -->
  <div id="studentView" class="view active">
    <div class="date-selector">
      <button class="date-btn" data-offset="-2">◀</button>
      <div class="weekdays" id="weekdays"></div>
      <button class="date-btn" data-offset="2">▶</button>
    </div>

    <div class="task-list" id="taskList">
      <div class="loading">加载中...</div>
    </div>

    <div class="action-bar">
      <button class="btn btn-secondary" id="copyPlanBtn">📋 复制上周计划</button>
      <button class="btn btn-primary" id="exportPdfBtn">📄 导出PDF</button>
    </div>
  </div>

  <!-- 家长视图 -->
  <div id="parentView" class="view">
    <div class="stats-summary" id="statsSummary">
      <div class="loading">加载中...</div>
    </div>

    <div class="daily-trend" id="dailyTrend"></div>

    <div class="subject-list" id="subjectList"></div>
  </div>

  <!-- 科目详情弹窗 -->
  <div class="modal" id="subjectModal">
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modalTitle">科目详情</h2>
        <button class="close-btn" id="closeModal">×</button>
      </div>
      <div class="modal-body" id="modalBody"></div>
    </div>
  </div>

  <script src="/js/utils.js"></script>
  <script src="/js/api.js"></script>
  <script src="/js/state.js"></script>
  <script src="/js/student.js"></script>
  <script src="/js/parent.js"></script>
  <script>
    // 初始化应用
    document.addEventListener('DOMContentLoaded', () => {
      // 视图切换
      document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
          const view = item.dataset.view;
          AppState.switchView(view);
        });
      });

      // 监听视图变化
      AppState.on('view-changed', () => {
        updateView();
      });

      // 初始化
      initStudentView();
      initParentView();
      updateView();
    });

    function updateView() {
      // 更新导航栏
      document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === AppState.currentView);
      });

      // 更新视图可见性
      document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
      });
      document.getElementById(`${AppState.currentView}View`).classList.add('active');

      // 加载对应视图数据
      if (AppState.currentView === 'student') {
        loadStudentData();
      } else {
        loadParentData();
      }
    }
  </script>
</body>
</html>
```

- [ ] **Step 2: 提交**

```bash
git add src/public/index.html
git commit -m "feat: add main HTML page with view switching"
```

---

## Task 12: 前端 - 样式文件

**Files:**
- Create: `src/public/css/style.css`

- [ ] **Step 1: 创建样式文件**

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
  background: #f5f5f5;
  color: #333;
}

/* 视图切换导航栏 */
.view-nav {
  background: white;
  border-bottom: 2px solid #ddd;
  display: flex;
  padding: 0;
}

.nav-item {
  padding: 16px 24px;
  color: #888;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-item.active {
  color: #667eea;
  border-bottom: 3px solid #667eea;
}

.nav-item:hover {
  background: #f9f9f9;
}

.nav-info {
  flex: 1;
  padding: 16px 24px;
  text-align: right;
  color: #888;
  font-size: 14px;
}

/* 视图容器 */
.view {
  display: none;
  padding: 16px;
  max-width: 1200px;
  margin: 0 auto;
}

.view.active {
  display: block;
}

/* 日期选择器 */
.date-selector {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  background: white;
  padding: 12px;
  border-radius: 8px;
}

.weekdays {
  display: flex;
  gap: 4px;
  flex: 1;
}

.weekday {
  flex: 1;
  text-align: center;
  padding: 8px;
  background: #eee;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.weekday.active {
  background: #667eea;
  color: white;
}

.date-btn {
  padding: 8px 16px;
  background: #ddd;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

/* 任务列表 */
.task-list {
  background: white;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.task-item {
  border-left: 4px solid #ddd;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: white;
  border: 1px solid #ddd;
}

.task-item.completed {
  opacity: 0.7;
}

.task-checkbox {
  width: 20px;
  height: 20px;
  cursor: pointer;
  margin-top: 2px;
}

.task-content {
  flex: 1;
}

.task-title {
  font-weight: bold;
  margin-bottom: 8px;
}

.task-inputs {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.task-inputs label {
  font-size: 12px;
  color: #888;
}

.task-inputs input {
  width: 80px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.task-time-badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #667eea;
  color: white;
}

.task-notes {
  margin-top: 6px;
}

.task-notes input {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}

/* 按钮样式 */
.action-bar {
  display: flex;
  gap: 8px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: white;
  border-top: 1px solid #ddd;
  padding: 12px;
}

.btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.btn:hover {
  opacity: 0.9;
}

.btn-primary {
  background: #e74c3c;
  color: white;
}

.btn-secondary {
  background: #667eea;
  color: white;
}

/* 家长视图样式 */
.stats-summary {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.stat-card {
  flex: 1;
  background: linear-gradient(135deg, #6c3483, #8e44ad);
  color: white;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
}

.subject-list {
  background: white;
  border-radius: 8px;
  padding: 16px;
}

.subject-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background: #f9f9f9;
  border-radius: 6px;
  cursor: pointer;
}

.subject-item:hover {
  background: #f0f0f0;
}

/* 弹窗 */
.modal {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
}

.modal.active {
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #ddd;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
}

.modal-body {
  padding: 16px;
}

/* Loading */
.loading {
  text-align: center;
  padding: 40px;
  color: #888;
}

/* Toast 动画 */
@keyframes slideUp {
  from {
    transform: translateX(-50%) translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/public/css/style.css
git commit -m "feat: add stylesheet"
```

---

## Task 13: 前端 - 学生视图逻辑

**Files:**
- Create: `src/public/js/student.js`

- [ ] **Step 1: 创建学生视图逻辑**

```javascript
// 初始化学生视图
function initStudentView() {
  renderWeekdays();
  setupEventListeners();
  loadStudentData();
}

function renderWeekdays() {
  const container = document.getElementById('weekdays');
  const weekDates = DateUtils.getWeekDates(AppState.getWeekStart());

  container.innerHTML = weekDates.map(date => {
    const displayDate = DateUtils.formatDisplay(date);
    const isActive = date === AppState.selectedDate;
    return `<div class="weekday ${isActive ? 'active' : ''}" data-date="${date}">
      ${displayDate.split(' ')[0]}<br><small>${displayDate.split(' ')[1]}</small>
    </div>`;
  }).join('');
}

function setupEventListeners() {
  // 日期选择
  document.getElementById('weekdays').addEventListener('click', (e) => {
    const weekday = e.target.closest('.weekday');
    if (weekday) {
      AppState.setSelectedDate(weekday.dataset.date);
      renderWeekdays();
      loadStudentData();
    }
  });

  // 日期导航
  document.querySelectorAll('.date-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const offset = parseInt(btn.dataset.offset);
      const newDate = new Date(AppState.selectedDate);
      newDate.setDate(newDate.getDate() + offset);
      AppState.setSelectedDate(DateUtils.format(newDate));
      renderWeekdays();
      loadStudentData();
    });
  });

  // 复制计划
  document.getElementById('copyPlanBtn').addEventListener('click', async () => {
    try {
      await PlanAPI.copyLastWeek();
      showToast('已复制上周计划', 'success');
      loadStudentData();
    } catch (err) {
      showToast('复制失败', 'error');
    }
  });

  // 导出PDF
  document.getElementById('exportPdfBtn').addEventListener('click', () => {
    ExportAPI.exportPDF(AppState.getWeekStart());
  });
}

async function loadStudentData() {
  const container = document.getElementById('taskList');
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const tasks = await AppState.loadTasksForDate(AppState.selectedDate);
    renderTasks(tasks);
    updateWeekInfo();
  } catch (err) {
    container.innerHTML = '<div class="loading">加载失败</div>';
  }
}

function renderTasks(tasks) {
  const container = document.getElementById('taskList');

  if (tasks.length === 0) {
    container.innerHTML = '<div class="loading">今日暂无任务</div>';
    return;
  }

  container.innerHTML = tasks.map(task => `
    <div class="task-item ${task.is_completed ? 'completed' : ''}"
         style="border-left-color: ${SubjectConfig.getColor(task.subject)}">
      <input type="checkbox" class="task-checkbox"
             ${task.is_completed ? 'checked' : ''}
             data-id="${task.id}">

      <div class="task-content">
        <div class="task-title">
          ${SubjectConfig.getIcon(task.subject)} ${task.subject} - ${task.title}
        </div>

        <div class="task-inputs">
          <label>开始:</label>
          <input type="time" class="start-time" value="${task.start_time || ''}" data-id="${task.id}">
          <label>结束:</label>
          <input type="time" class="end-time" value="${task.end_time || ''}" data-id="${task.id}">
          ${task.time_spent ? `<span class="task-time-badge">${TimeUtils.formatMinutes(task.time_spent)}</span>` : ''}
        </div>

        <div class="task-notes">
          <input type="text" class="notes-input" placeholder="备注：可记录学习内容、难点等"
                 value="${task.notes || ''}" data-id="${task.id}">
        </div>
      </div>
    </div>
  `).join('');

  // 绑定事件
  setupTaskEvents();
}

function setupTaskEvents() {
  // 复选框
  document.querySelectorAll('.task-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', async (e) => {
      const taskId = parseInt(e.target.dataset.id);
      try {
        await TaskAPI.complete(taskId);
        loadStudentData();
      } catch (err) {
        e.target.checked = !e.target.checked;
      }
    });
  });

  // 时间输入
  document.querySelectorAll('.end-time').forEach(input => {
    input.addEventListener('change', async (e) => {
      const taskId = parseInt(e.target.dataset.id);
      const startTime = document.querySelector(`.start-time[data-id="${taskId}"]`).value;
      const endTime = e.target.value;

      if (startTime && endTime) {
        if (!TimeUtils.validateTime(startTime) || !TimeUtils.validateTime(endTime)) {
          showToast('时间格式无效', 'error');
          return;
        }

        try {
          await AppState.updateTask(taskId, {
            start_time: startTime,
            end_time: endTime,
            is_completed: true
          });
          loadStudentData();
        } catch (err) {
          showToast('更新失败', 'error');
        }
      }
    });
  });

  // 备注输入
  document.querySelectorAll('.notes-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const taskId = parseInt(e.target.dataset.id);
      try {
        await AppState.updateTask(taskId, { notes: e.target.value });
      } catch (err) {
        showToast('保存失败', 'error');
      }
    });
  });
}

function updateWeekInfo() {
  const info = document.getElementById('weekInfo');
  const weekStart = AppState.getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  info.textContent = `第 ${getWeekNumber(weekStart)} 周 | ${weekStart} ~ ${DateUtils.format(weekEnd)}`;
}

function getWeekNumber(dateStr) {
  const date = new Date(dateStr);
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - start) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + date.getDay() + 1) / 7);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/public/js/student.js
git commit -m "feat: add student view logic"
```

---

## Task 14: 前端 - 家长视图逻辑

**Files:**
- Create: `src/public/js/parent.js`

- [ ] **Step 1: 创建家长视图逻辑**

```javascript
// 初始化家长视图
function initParentView() {
  setupModalEvents();
}

function loadParentData() {
  loadStatsSummary();
  loadDailyTrend();
  loadSubjectList();
}

async function loadStatsSummary() {
  const container = document.getElementById('statsSummary');
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const stats = await AppState.loadWeekStats(AppState.getWeekStart());

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.total_hours}h</div>
        <div class="stat-label">本周总用时</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.daily_average}h</div>
        <div class="stat-label">日均用时</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.completion_rate}%</div>
        <div class="stat-label">完成率</div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="loading">加载失败</div>';
  }
}

function loadDailyTrend() {
  const container = document.getElementById('dailyTrend');
  const stats = AppState.statsCache.weekStats;

  if (!stats || !stats.daily_trend) {
    container.innerHTML = '';
    return;
  }

  const maxHours = Math.max(...stats.daily_trend.map(d => d.hours));

  container.innerHTML = `
    <h3 style="font-size: 14px; color: #666; margin: 16px 0 8px;">每日用时</h3>
    <div style="display: flex; gap: 8px; height: 100px; padding: 12px; background: white; border-radius: 8px; align-items: flex-end;">
      ${stats.daily_trend.map(day => {
        const height = maxHours > 0 ? (day.hours / maxHours) * 80 : 0;
        return `
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 10px; margin-bottom: 4px;">${day.hours}h</div>
            <div style="background: ${day.hours > 0 ? '#667eea' : '#ddd'}; height: ${height}px; border-radius: 4px 4px 0 0; min-height: 4px;"></div>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">${day.date.slice(5)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function loadSubjectList() {
  const container = document.getElementById('subjectList');
  const stats = AppState.statsCache.weekStats;

  if (!stats || !stats.by_subject) {
    container.innerHTML = '<div class="loading">加载中...</div>';
    return;
  }

  container.innerHTML = `
    <h3 style="font-size: 14px; color: #666; margin-bottom: 8px;">各科目详情（点击查看）</h3>
    ${stats.by_subject.map(subject => `
      <div class="subject-item" data-subject="${subject.subject}">
        <div>
          <div style="font-weight: bold;">${SubjectConfig.getIcon(subject.subject)} ${subject.subject}</div>
          <div style="font-size: 11px; color: #888;">
            ${subject.completed}/${subject.total} 完成 | ${subject.total_hours}h | ${subject.percentage}%
          </div>
        </div>
        <span style="font-size: 18px;">›</span>
      </div>
    `).join('')}
  `;

  // 绑定点击事件
  container.querySelectorAll('.subject-item').forEach(item => {
    item.addEventListener('click', () => showSubjectDetail(item.dataset.subject));
  });
}

async function showSubjectDetail(subject) {
  const modal = document.getElementById('subjectModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = `${SubjectConfig.getIcon(subject)} ${subject} 详情`;
  body.innerHTML = '<div class="loading">加载中...</div>';
  modal.classList.add('active');

  try {
    const detail = await StatsAPI.getSubject(subject, AppState.getWeekStart());

    body.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <div style="flex: 1; background: #fffbeb; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #e67e00;">${detail.completed_count}/${detail.task_count}</div>
          <div style="font-size: 11px; color: #888;">任务完成</div>
        </div>
        <div style="flex: 1; background: #dbeafe; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #1a6fb5;">${detail.total_hours}h</div>
          <div style="font-size: 11px; color: #888;">总用时</div>
        </div>
        <div style="flex: 1; background: #dcfce7; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #1e8449;">${detail.completion_rate}%</div>
          <div style="font-size: 11px; color: #888;">完成率</div>
        </div>
      </div>

      <h4 style="font-size: 14px; margin-bottom: 8px;">每日完成详情</h4>
      ${detail.daily_details.map(day => `
        <div style="background: ${day.tasks.length > 0 ? 'white' : '#f9f9f9'}; border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">${day.date}</div>
          ${day.tasks.map(task => `
            <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0;">
              <span>${task.completed ? '✓' : '✗'} ${task.title}</span>
              <span style="color: #888;">${task.timeSpent ? TimeUtils.formatMinutes(task.timeSpent) : '-'}</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  } catch (err) {
    body.innerHTML = '<div class="loading">加载失败</div>';
  }
}

function setupModalEvents() {
  // 关闭弹窗
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('subjectModal').classList.remove('active');
  });

  // 点击背景关闭
  document.getElementById('subjectModal').addEventListener('click', (e) => {
    if (e.target.id === 'subjectModal') {
      document.getElementById('subjectModal').classList.remove('active');
    }
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add src/public/js/parent.js
git commit -m "feat: add parent view logic"
```

---

## Task 15: 一键启动脚本

**Files:**
- Create: `start.sh`

- [ ] **Step 1: 创建启动脚本**

```bash
#!/bin/bash

echo "🚀 启动学习计划跟踪系统..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js"
    echo "   访问 https://nodejs.org/ 下载安装"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
fi

# 确保数据目录存在
mkdir -p data/backups
mkdir -p uploads

# 启动服务器
echo ""
echo "✅ 启动服务器..."
echo "📱 学生界面: http://localhost:3000"
echo "👁️  家长界面: 点击顶部导航切换"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

node src/server.js
```

- [ ] **Step 2: 赋予执行权限**

Run: `chmod +x start.sh`

- [ ] **Step 3: 提交**

```bash
git add start.sh
git commit -m "feat: add one-click start script"
```

---

## Task 16: 初始数据种子

**Files:**
- Modify: `src/database.js`

- [ ] **Step 1: 添加初始数据导入功能**

在 `database.js` 的 `createTables` 方法后添加：

```javascript
async seedDefaultData() {
  try {
    // 检查是否已有数据
    const existingPlans = await this.get('SELECT COUNT(*) as count FROM plans');
    if (existingPlans.count > 0) {
      console.log('ℹ️  Database already seeded, skipping...');
      return;
    }

    // 获取当前周周一作为计划开始日期
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const weekStart = new Date(today.setDate(diff));
    const weekStartStr = this.formatDateLocal(weekStart);

    // 创建默认周内计划
    const planResult = await this.run(
      `INSERT INTO plans (name, type, week_start, is_active)
       VALUES (?, ?, ?, 1)`,
      ['周内标准计划', 'weekday', weekStartStr]
    );

    // 默认任务
    const defaultTasks = [
      { subject: '数学', title: '《练到位》练习', days: ['Mon','Tue','Wed','Thu','Fri'] },
      { subject: '物理', title: '《必刷题》练习', days: ['Mon','Tue','Wed','Thu','Fri'] },
      { subject: '化学', title: '《每日一题》', days: ['Mon','Tue','Wed','Thu','Fri'] },
      { subject: '生物', title: '《必刷题》练习', days: ['Mon','Tue','Wed','Thu','Fri'] },
      { subject: '语文', title: '《高考真题》练习', days: ['Mon','Tue','Wed','Thu','Fri'] },
      { subject: '英语', title: '《语法填空》2篇', days: ['Mon','Tue','Wed','Thu','Fri'] },
      { subject: '英语', title: '《每日一句》+单词', days: ['Mon','Tue','Wed','Thu','Fri'] }
    ];

    const weekMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

    for (const taskData of defaultTasks) {
      for (const day of taskData.days) {
        // 计算具体日期
        const targetDay = weekMap[day];
        const taskDate = new Date(weekStart);
        const currentDay = taskDate.getDay();
        const dayDiff = targetDay - (currentDay === 0 ? 7 : currentDay);
        taskDate.setDate(taskDate.getDate() + dayDiff);
        const taskDateStr = this.formatDateLocal(taskDate);

        const taskResult = await this.run(
          'INSERT INTO tasks (title, subject, type, date, is_completed) VALUES (?, ?, ?, ?, 0)',
          [taskData.title, taskData.subject, 'weekday', taskDateStr]
        );

        await this.run(
          'INSERT INTO plan_tasks (plan_id, task_id, day_of_week) VALUES (?, ?, ?)',
          [planResult.id, taskResult.id, day]
        );
      }
    }

    console.log('✅ Default data seeded successfully');
  } catch (err) {
    console.error('❌ Failed to seed default data:', err);
    throw err;
  }
}

// 辅助方法：格式化日期为本地时区 YYYY-MM-DD
formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

然后在 `server.js` 的 `start()` 函数中，在 `createTables()` 后添加：

```javascript
await database.seedDefaultData();
```

- [ ] **Step 2: 提交**

```bash
git add src/database.js src/server.js
git commit -m "feat: add default data seeding"
```

---

## Task 17: 测试与验证

**Files:**
- (None - manual testing)

- [ ] **Step 1: 启动服务器验证**

Run: `./start.sh`
Expected outputs:
```
🚀 启动学习计划跟踪系统...
✅ Database initialized
✅ Default data seeded successfully
🚀 Server running at http://localhost:3000
```

If error occurs: 检查 Node.js 版本是否 >= 14

- [ ] **Step 2: 测试学生视图 - 基础功能**

访问 http://localhost:3000

验证点:
- [ ] 页面正常加载，无控制台错误
- [ ] 日期选择器显示7天（周一至周日）
- [ ] 当前日期被高亮显示
- [ ] 显示默认任务列表（7个任务）

- [ ] **Step 3: 测试学生视图 - 任务打卡**

1. 点击任意任务的复选框
2. 验证任务显示为已完成（变淡）
3. 刷新页面，验证状态保持

Expected: 任务保持完成状态

- [ ] **Step 4: 测试学生视图 - 时间输入**

1. 选择一个任务
2. 输入开始时间: 18:00
3. 输入结束时间: 18:45
4. 等待自动保存

验证点:
- [ ] 时间徽章显示 "45分钟"
- [ ] 任务自动标记为完成
- [ ] 刷新后时间数据保持

边缘测试:
- [ ] 测试结束时间早于开始时间（应显示错误）
- [ ] 测试只输入开始时间（不计算用时）
- [ ] 测试不输入时间（正常工作）

- [ ] **Step 5: 测试学生视图 - 备注功能**

1. 在备注框输入: "完成了三角函数章节，正确率80%"
2. 切换到其他日期再切回
3. 验证备注内容保持

- [ ] **Step 6: 测试家长视图 - 统计概览**

1. 点击"家长视图"Tab
2. 验证统计卡片显示
3. 验证数据准确性:
   - 总用时 = 所有任务用时之和
   - 完成率 = 已完成/总数 * 100
   - 日均 = 总用时/7

- [ ] **Step 7: 测试家长视图 - 科目详情**

1. 点击任意科目（如"数学"）
2. 验证弹窗打开
3. 验证显示:
   - 3个统计卡片（任务、用时、完成率）
   - 每日完成详情列表
   - 完成任务显示 ✓，未完成显示 ✗

- [ ] **Step 8: 测试PDF导出**

1. 在学生视图点击"导出PDF"按钮
2. 验证PDF下载（文件名: weekly-tracker-YYYY-MM-DD.pdf）
3. 打开PDF验证:
   - [ ] 页面方向为横向
   - [ ] 包含所有7个科目
   - [ ] 每个任务有空方框和时间横线
   - [ ] 科目颜色与界面一致

- [ ] **Step 9: 测试视图切换**

1. 在学生视图中完成一些任务
2. 切换到家长视图
3. 验证统计数据包含刚才的任务
4. 切回学生视图
5. 验证任务状态保持

- [ ] **Step 10: 测试数据持久化**

1. 停止服务器 (Ctrl+C)
2. 检查 `data/tasks.db` 文件存在
3. 重新启动服务器 `./start.sh`
4. 访问学生视图
5. 验证:
   - [ ] 之前完成的任务仍然显示完成
   - [ ] 时间数据保持
   - [ ] 备注内容保持

- [ ] **Step 11: 边缘情况测试**

1. 测试空数据库（删除 data/tasks.db 后重启）
2. 测试未来日期（点击下一周）
3. 测试无效时间输入（输入 25:00）
4. 测试并发操作（开两个浏览器窗口同时操作）

- [ ] **Step 12: 修复发现的问题**

记录测试日志:
```
测试时间: ___________
测试人员: ___________
发现的问题:
1.
2.
3.

解决方案:
1.
2.
3.
```

- [ ] **Step 13: 最终验证**

确保所有功能正常:
- [ ] 学生视图: 打卡、时间、备注 ✓
- [ ] 家长视图: 统计、详情 ✓
- [ ] PDF导出: 下载成功、格式正确 ✓
- [ ] 数据持久化: 重启后数据保持 ✓
- [ ] 视图切换: 状态同步正确 ✓

- [ ] **Step 14: 提交修复**

```bash
git add -A
git commit -m "test: fix issues found during testing

测试发现的问题:
- 修复: [问题描述]
- 优化: [问题描述]"
```

---

## Task 18: README 文档

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 README 文档**

```markdown
# 高中生课外任务进度跟踪打卡系统

一个简洁高效的学习任务管理系统，帮助高中生和家长协同管理课外学习计划。

## 功能特点

- ✅ **双视图设计**: 学生视图专注任务打卡，家长视图监督学习进度
- ✅ **灵活的计划管理**: 支持周内/周末计划模板，快速创建和复制计划
- ✅ **PDF 导出**: 导出空白跟踪表，支持打印后手动填写
- ✅ **数据持久化**: SQLite 本地存储，一键启动/停止
- ✅ **时间追踪**: 自动计算学习用时，统计每日/每周数据

## 快速开始

### 环境要求

- Node.js 14+
- npm 或 yarn

### 安装

```bash
# 克隆项目（如适用）
cd kids

# 安装依赖
npm install
```

### 启动

```bash
# 一键启动
./start.sh

# 或使用 npm
npm start
```

访问 http://localhost:3000 开始使用。

## 使用指南

### 学生视图

1. **选择日期**: 点击顶部日期选择当天
2. **查看任务**: 查看当天所有待办任务
3. **打卡**: 点击复选框标记任务完成
4. **记录时间**: 输入开始和结束时间，自动计算用时
5. **添加备注**: 在备注框记录学习内容、难点等

### 家长视图

1. **查看统计**: 顶部卡片显示本周总用时、完成率等
2. **每日趋势**: 柱状图展示每天学习时间
3. **科目详情**: 点击科目查看每日完成详情

### 计划管理

- **复制上周计划**: 点击底部"复制上周计划"按钮
- **导出PDF**: 点击"导出PDF"下载可打印的空白跟踪表

## 技术栈

- **后端**: Node.js + Express
- **数据库**: SQLite3
- **PDF生成**: Puppeteer
- **前端**: HTML + CSS + Vanilla JavaScript

## 项目结构

```
kids/
├── src/
│   ├── server.js           # Express 服务器
│   ├── database.js         # SQLite 数据库
│   ├── routes/             # API 路由
│   └── public/             # 前端文件
├── data/                   # 数据库文件
├── start.sh               # 启动脚本
└── README.md              # 本文件
```

## 配置

配置文件位于 `config.json`：

```json
{
  "server": {
    "port": 3000
  },
  "database": {
    "path": "./data/tasks.db"
  }
}
```

## 常见问题

**Q: 数据保存在哪里？**
A: 所有数据保存在本地 `data/tasks.db` SQLite 数据库文件中。

**Q: 可以修改端口吗？**
A: 可以，编辑 `config.json` 中的 `server.port` 配置。

**Q: 如何备份数据？**
A: 系统会在每次启动时自动备份到 `data/backups/` 目录。

## 许可证

MIT
```

- [ ] **Step 2: 提交**

```bash
git add README.md
git commit -m "docs: add README documentation"
```

---

## 完成检查清单

在提交最终版本前，确认以下项目：

- [ ] 所有 18 个任务已完成
- [ ] 服务器可以正常启动和停止
- [ ] 学生视图功能完整（打卡、时间、备注）
- [ ] 家长视图功能完整（统计、详情）
- [ ] 视图切换正常工作
- [ ] PDF 导出功能正常
- [ ] 数据持久化正常（重启后数据保留）
- [ ] 启动脚本可以一键启动
- [ ] README 文档完整
- [ ] 没有控制台错误或警告

---

## 实施说明

本计划采用 TDD 方法，每个任务都应：
1. 先编写/理解需求
2. 实现功能
3. 测试验证
4. 提交代码

建议按照任务顺序依次实施，每个任务完成后立即提交，确保代码库始终处于可工作状态。

遇到问题时，参考 `docs/superpowers/specs/2026-03-23-study-tracker-design.md` 设计文档。
