# 高中生课外任务进度跟踪打卡系统 - 设计文档

**日期**: 2026-03-23
**版本**: 1.0
**状态**: 待审批

---

## 1. 项目概述

### 1.1 项目目标

构建一个在线任务跟踪和打卡系统，帮助高中学生和家长协同管理课外学习任务。系统支持每日/每周任务计划与跟踪、计划调整、打印跟踪表、数据持久化和一键启动。

### 1.2 核心用户

- **主要用户**: 高中一年级学生
- **次要用户**: 家长（监督和查看）

### 1.3 功能优先级

1. 在线查看和打勾完成任务
2. 计划模板和快速创建
3. 打印功能（导出PDF跟踪表）
4. 数据持久化（SQLite）
5. 时间统计和周报表
6. 拍照OCR自动录入（未来功能）

---

## 2. 系统架构

### 2.1 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Node.js + Express |
| 前端 | HTML + CSS + Vanilla JavaScript |
| 数据库 | SQLite |
| PDF生成 | Puppeteer |
| 部署 | 本地运行 |

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Express Server (Port 3000)              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              静态文件服务 (Static Files)              │   │
│  │  / → index.html (主界面，含学生/家长视图切换)          │   │
│  │  /css, /js → 样式和脚本                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↑↓                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  API 路由层                          │   │
│  │  /api/tasks/*     - 任务CRUD                         │   │
│  │  /api/plans/*     - 计划管理                         │   │
│  │  /api/stats/*     - 统计数据                         │   │
│  │  /api/export/pdf  - PDF导出                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ↑↓                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  数据层                              │   │
│  │  SQLite Database (data/tasks.db)                     │   │
│  │  - tasks, plans, plan_tasks, activity_logs           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 文件结构

```
kids/
├── package.json              # 项目配置
├── config.json               # 配置文件
├── start.sh                  # 一键启动脚本
├── src/
│   ├── server.js             # 服务入口
│   ├── database.js           # 数据库初始化
│   ├── routes/
│   │   ├── tasks.js          # 任务 API
│   │   ├── plans.js          # 计划 API
│   │   ├── stats.js          # 统计 API
│   │   └── export.js         # PDF导出 API
│   └── public/
│       ├── index.html        # 主界面（含视图切换）
│       ├── css/
│       │   └── style.css     # 样式
│       └── js/
│           ├── api.js        # API封装
│           ├── state.js      # 状态管理
│           ├── student.js    # 学生视图
│           └── parent.js     # 家长视图
├── data/
│   ├── tasks.db              # SQLite数据库
│   └── backups/              # 数据库备份
└── uploads/                  # 未来的照片上传目录
```

---

## 3. 数据库设计

### 3.1 数据表

**tasks 表（任务）**
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subject TEXT,
  type TEXT,
  plan_id INTEGER,
  date DATE,
  is_completed BOOLEAN DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  time_spent INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plan_id) REFERENCES plans(id)
);
```

**plans 表（计划模板）**
```sql
CREATE TABLE plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT,
  week_start DATE,
  is_active BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**plan_tasks 表（计划任务关联）**
```sql
CREATE TABLE plan_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  day_of_week TEXT,
  sort_order INTEGER,
  FOREIGN KEY (plan_id) REFERENCES plans(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

**activity_logs 表（操作日志）**
```sql
CREATE TABLE activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  user_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 初始数据

预设计划模板包含周内和周末两类，涵盖数学、物理、化学、生物、语文、英语等科目。

---

## 4. 用户界面设计

### 4.1 视图切换

页面顶部设有导航栏Tab切换：

```
┌─────────────────────────────────────────────────────┐
│ 📚 学生视图  │  👁️ 家长视图           第12周 | ...  │
└─────────────────────────────────────────────────────┘
```

### 4.2 学生视图

**功能**:
- 日期选择器（周一至周日）
- 任务列表显示当天任务
- 每个任务包含：
  - 完成复选框
  - 开始/结束时间输入
  - 备注输入框
- "复制上周计划"按钮
- "导出PDF"按钮

**交互**:
- 点击复选框标记完成
- 输入时间自动计算用时
- 备注框记录额外信息

### 4.3 家长视图

**功能**:
- 周统计概览（总用时、完成率、日均用时）
- 每日用时柱状图
- 科目列表（可点击查看详情）
- 最近变更日志

**科目详情弹窗**（点击科目后弹出）:
- 统计指标：任务完成数、平均用时、完成率
- 每日完成详情列表
- 时间分配饼图

---

## 5. API 设计

### 5.1 通用响应格式

所有API响应遵循统一格式：

**成功响应**:
```json
{
  "success": true,
  "data": { /* 响应数据 */ }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "错误描述",
    "details": {}
  }
}
```

### 5.2 任务相关

**获取指定日期的任务**
```
GET /api/tasks?date=2024-03-19

Response:
{
  "success": true,
  "data": {
    "date": "2024-03-19",
    "tasks": [
      {
        "id": 1,
        "title": "《练到位》练习",
        "subject": "数学",
        "type": "daily",
        "is_completed": true,
        "start_time": "18:00",
        "end_time": "18:45",
        "time_spent": 45,
        "notes": "完成了三角函数章节，正确率80%"
      },
      ...
    ]
  }
}
```

**更新任务**
```
PUT /api/tasks/:id
Body:
{
  "is_completed": true,
  "start_time": "18:00",
  "end_time": "18:45",
  "notes": "备注内容"
}

Response:
{
  "success": true,
  "data": {
    "id": 1,
    "is_completed": true,
    "time_spent": 45,
    "updated_at": "2024-03-19T18:45:00Z"
  }
}
```

### 5.3 计划相关

**获取当前激活的计划**
```
GET /api/plans/active

Response:
{
  "success": true,
  "data": {
    "id": 12,
    "week_start": "2024-03-18",
    "week_end": "2024-03-24",
    "tasks": [
      {
        "id": 1,
        "title": "《练到位》练习",
        "subject": "数学",
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri"]
      },
      ...
    ]
  }
}
```

**从模板创建新周计划**
```
POST /api/plans/create-from-template
Body:
{
  "week_start": "2024-03-25",
  "template_type": "weekday"
}

Response:
{
  "success": true,
  "data": {
    "plan_id": 13,
    "tasks_created": 14,
    "week_start": "2024-03-25"
  }
}
```

### 5.4 统计相关

**周统计数据**
```
GET /api/stats/week?weekStart=2024-03-18

Response:
{
  "success": true,
  "data": {
    "total_hours": 12.5,
    "daily_average": 1.8,
    "completion_rate": 68,
    "total_tasks": 42,
    "completed_tasks": 29,
    "by_subject": [
      {"subject": "数学", "total_hours": 4.0, "percentage": 32, "completed": 5, "total": 6},
      {"subject": "物理", "total_hours": 2.8, "percentage": 22, "completed": 4, "total": 6}
    ],
    "daily_trend": [
      {"date": "2024-03-18", "hours": 2.1, "completed": 5, "total": 7},
      {"date": "2024-03-19", "hours": 1.5, "completed": 4, "total": 7}
    ]
  }
}
```

### 5.5 PDF导出

```
GET /api/export/pdf?weekStart=2024-03-18

Response: PDF file (application/pdf)
```

### 5.6 错误代码

| 代码 | HTTP状态 | 描述 |
|------|----------|------|
| VALIDATION_ERROR | 400 | 请求参数验证失败 |
| NOT_FOUND | 404 | 资源不存在 |
| DATABASE_ERROR | 500 | 数据库操作失败 |
| INVALID_DATE | 400 | 日期格式错误 |
| INVALID_TIME_RANGE | 400 | 时间范围无效 |

---

## 6. 数据与时间处理标准

### 6.1 日期格式

- **存储格式**: ISO 8601 YYYY-MM-DD (如: 2024-03-19)
- **数据库存储**: TEXT类型
- **时区**: 使用本地时区，不进行时区转换
- **SQLite查询**: 支持日期比较和范围查询

```javascript
// 日期处理工具函数
const DateUtils = {
  // 获取周的周一日期
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return this.format(new Date(d.setDate(diff)));
  },

  // 格式化为 YYYY-MM-DD
  format(date) {
    return date.toISOString().split('T')[0];
  },

  // 解析日期字符串
  parse(dateStr) {
    return new Date(dateStr + 'T00:00:00');
  }
};
```

### 6.2 时间格式

- **显示格式**: HH:MM (24小时制)
- **输入验证**: 必须符合 "HH:MM" 格式
- **计算**: 以分钟为单位存储 time_spent

### 6.3 时间计算逻辑

```javascript
// 计算用时（分钟）
function calculateTimeSpent(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // 跨午夜处理
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

// 验证时间范围
function validateTimeRange(startTime, endTime) {
  if (!startTime || !endTime) return true; // 允许空值
  return calculateTimeSpent(startTime, endTime) > 0;
}
```

---

## 7. 状态管理架构

### 7.1 客户端状态

```javascript
// src/public/js/state.js
const AppState = {
  // 用户当前选择的视图
  currentView: 'student', // 'student' | 'parent'

  // 选中的日期
  selectedDate: DateUtils.format(new Date()),

  // 当前周数据
  currentWeek: {
    start: null,
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

  // 方法
  async loadWeekData(weekStart) {
    const response = await fetch(`/api/stats/week?weekStart=${weekStart}`);
    const result = await response.json();
    this.currentWeek = result.data;
  },

  async updateTask(taskId, data) {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  },

  switchView(view) {
    this.currentView = view;
    renderView();
  }
};
```

### 7.2 数据同步策略

- **主动同步**: 用户操作后立即调用API更新
- **被动刷新**: 切换视图/日期时重新加载数据
- **无实时同步**: 不使用WebSocket，依赖用户手动刷新
- **冲突处理**: 以后更新为准（简单Last-Write-Wins）

### 7.3 视图切换流程

```javascript
function switchView(view) {
  // 1. 更新状态
  AppState.currentView = view;

  // 2. 更新UI
  updateTabStyles(view);

  // 3. 渲染对应视图
  if (view === 'student') {
    renderStudentView();
  } else {
    renderParentView();
  }
}
```

---

## 8. 安全与访问控制

### 8.1 访问模型

由于是本地运行系统，采用简单的视图隔离：

- **无身份验证**: 任何能访问 localhost:3000 的用户都可以使用
- **视图隔离**: 学生和家长视图在客户端切换，无服务器端权限验证
- **未来扩展**: Section 10.1 提到的PIN码功能

### 8.2 数据安全

- 所有数据存储在本地 SQLite 数据库
- 无外部网络请求
- 无用户数据上传

### 8.3 未来PIN码设计（预留）

```javascript
// 预留的PIN码验证接口
POST /api/auth/verify-pin
Body: { "pin": "1234", "user_type": "parent" }
Response: { "success": true, "token": "..." }
```

---

## 9. PDF导出功能

### 9.1 PDF规格

| 属性 | 值 |
|------|-----|
| 格式 | A4 |
| 方向 | 横向 (Landscape) |
| 页数 | 1页 |
| 字体 | 微软雅黑/PingFang SC |

### 9.2 PDF内容结构

导出的是**空白跟踪表模板**（不包含已填写的数据），供打印后手动填写：

**页头区域**:
- 标题: "📚 高一课外学习 · 每周计划跟踪表"
- 副标题: 使用说明
- 周次和日期范围（空白横线供手写）

**周内任务表**:
- 表头: 科目 | 任务内容 | 周一至周五 | 备注
- 行结构: 每个任务一行
- 单元格内容:
  - 完成方格：空方框 □
  - 时间横线：_______ 分
- 科目颜色: 与界面一致（附录A）

**周末任务表**:
- 表头: 科目 | 任务内容 | 周六 | 周日 | 备注
- 内容结构同周内表

**页脚**:
- 使用说明文字

### 9.3 模板数据来源

PDF模板基于当前激活的计划（`/api/plans/active`）生成：
- 获取计划中的任务列表
- 按科目和星期分组
- 渲染为HTML表格
- 转换为PDF

### 9.4 技术实现

```javascript
// PDF生成流程
async function generateWeeklyPDF(weekStart) {
  // 1. 获取计划数据
  const plan = await getActivePlan(weekStart);

  // 2. 渲染HTML模板
  const html = renderPDFTemplate(plan);

  // 3. 使用Puppeteer生成PDF
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true
  });
  await browser.close();

  return pdf;
}
```

---

## 10. 错误处理

### 10.1 前端错误处理

```javascript
class APIError {
  static async handle(response) {
    if (!response.ok) {
      const error = await response.json();

      switch(error.error.code) {
        case 'VALIDATION_ERROR':
          showToast('输入数据格式错误', 'error');
          break;
        case 'NOT_FOUND':
          showToast('未找到数据', 'warning');
          break;
        case 'DATABASE_ERROR':
          showToast('数据保存失败，请重试', 'error');
          break;
        case 'INVALID_TIME_RANGE':
          showToast('结束时间必须晚于开始时间', 'error');
          break;
        default:
          showToast('操作失败，请重试', 'error');
      }

      throw error;
    }
    return response.json();
  }
}
```

### 10.2 后端错误处理

```javascript
// 错误中间件
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  const status = err.status || 500;
  const code = err.code || 'UNKNOWN_ERROR';

  res.status(status).json({
    success: false,
    error: {
      code: code,
      message: err.message || '服务器错误',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
});
```

---

## 11. 数据持久化与迁移

### 11.1 备份策略

- 服务器启动时自动备份
- 每天定时备份（可选）
- 保留最近7天备份
- 备份路径：`./data/backups/`

### 11.2 恢复机制

- 启动时检查数据库完整性
- 数据库损坏时从备份恢复
- 首次运行时创建新数据库并导入默认模板

### 11.3 数据库版本控制

```javascript
// 数据库版本表
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

// 迁移脚本示例
const migrations = {
  1: `CREATE TABLE tasks (...)`,
  2: `ALTER TABLE tasks ADD COLUMN start_time TEXT`,
  3: `ALTER TABLE tasks ADD COLUMN end_time TEXT`
};

async function migrate() {
  const currentVersion = await getCurrentVersion();
  for (let v = currentVersion + 1; v <= Object.keys(migrations).length; v++) {
    await db.exec(migrations[v]);
    await db.run('INSERT INTO schema_migrations (version) VALUES (?)', v);
  }
}
```

---

## 12. 部署与启动

### 12.1 一键启动

```bash
# 给予执行权限
chmod +x start.sh

# 启动
./start.sh
```

启动脚本会：
1. 检查Node.js环境
2. 安装依赖（如需要）
3. 创建必要目录
4. 运行数据库迁移
5. 启动服务器
6. 显示访问地址

### 12.2 访问地址

- 主页面: http://localhost:3000
- 学生视图: 点击顶部"学生视图"Tab
- 家长视图: 点击顶部"家长视图"Tab

### 12.3 停止服务

按 `Ctrl+C` 停止服务器，数据会自动保存。

---

## 13. 未来扩展

### 13.1 MVP范围（第一阶段）

核心功能：
- ✅ 学生视图：任务列表、打卡、时间记录
- ✅ 家长视图：统计概览、科目详情
- ✅ 计划模板：周内/周末模板
- ✅ PDF导出：空白跟踪表
- ✅ 数据持久化：SQLite + 备份
- ✅ 一键启动/停止

### 13.2 短期扩展（第二阶段）

- 用户认证（简单的PIN码）
- 数据导出（Excel格式）
- 更多种科目自定义

### 13.3 长期扩展（第三阶段）

- OCR照片识别录入
- 移动端适配
- 多学生支持
- 云端同步

---

## 附录A：科目颜色编码

| 科目 | 颜色 | 代码 |
|------|------|------|
| 数学 | 橙色 | #e67e00 |
| 物理 | 蓝色 | #1a6fb5 |
| 化学 | 红色 | #b03020 |
| 生物 | 绿色 | #1e8449 |
| 语文 | 紫色 | #7d3c98 |
| 英语 | 深灰 | #1a252f |
| 运动 | 红棕 | #c0392b |

## 附录B：默认计划模板

详见 `shedule.md` 文件，包含完整的周内和周末任务列表。
