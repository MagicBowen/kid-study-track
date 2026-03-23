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
          <input type="text" class="notes-input" placeholder="备注:可记录学习内容、难点等"
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
