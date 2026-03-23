const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const config = require('../config.json');

class Database {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.isClosed = false;
  }

  async initialize() {
    // 防止重复初始化
    if (this.isInitialized) {
      return Promise.resolve();
    }

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
        else {
          this.isInitialized = true;
          this.isClosed = false;
          resolve();
        }
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

  async run(sql, params = []) {
    if (!this.isInitialized || this.isClosed) {
      throw new Error('Database is not initialized or has been closed');
    }
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    if (!this.isInitialized || this.isClosed) {
      throw new Error('Database is not initialized or has been closed');
    }
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    if (!this.isInitialized || this.isClosed) {
      throw new Error('Database is not initialized or has been closed');
    }
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    // 防止重复关闭
    if (this.isClosed) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else {
          this.isClosed = true;
          this.isInitialized = false;
          resolve();
        }
      });
    });
  }
}

module.exports = new Database();
