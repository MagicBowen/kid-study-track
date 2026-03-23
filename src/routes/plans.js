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

    // 验证参数
    if (!week_start || !template_type) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' }
      });
    }

    // 验证模板类型
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

    // 创建任务
    const taskPromises = [];
    let sortOrder = 0;

    for (const taskData of template.tasks) {
      for (const day of taskData.days) {
        taskPromises.push(
          (async () => {
            const taskDate = getTaskDate(week_start, day);
            const result = await database.run(
              'INSERT INTO tasks (title, subject, type, date, is_completed) VALUES (?, ?, ?, ?, 0)',
              [taskData.title, taskData.subject, template_type, taskDate]
            );
            await database.run(
              'INSERT INTO plan_tasks (plan_id, task_id, day_of_week, sort_order) VALUES (?, ?, ?, ?)',
              [planResult.id, result.id, day, sortOrder++]
            );
            return result.id;
          })()
        );
      }
    }

    await Promise.all(taskPromises);

    // 取消其他计划的激活状态
    await database.run('UPDATE plans SET is_active = 0 WHERE id != ?', [planResult.id]);

    res.json({
      success: true,
      data: {
        plan_id: planResult.id,
        tasks_created: taskPromises.length,
        week_start
      }
    });
  } catch (err) {
    next(err);
  }
});

// 根据周开始日期和星期几获取具体日期（使用本地时区，避免UTC转换问题）
function getTaskDate(weekStart, dayOfWeek) {
  const weekMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const date = new Date(weekStart);
  const targetDay = weekMap[dayOfWeek];
  const currentDay = date.getDay();
  const diff = targetDay - (currentDay === 0 ? 7 : currentDay);
  date.setDate(date.getDate() + diff);

  // 使用本地时区格式化
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = router;
