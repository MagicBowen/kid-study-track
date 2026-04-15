// 默认科目列表
const DEFAULT_SUBJECTS = ['数学', '物理', '化学', '生物', '语文', '英语', '运动'];

// 获取所有科目（默认 + 自定义）
function getAllSubjects() {
  const customSubjects = JSON.parse(localStorage.getItem('customSubjects') || '[]');
  return [...DEFAULT_SUBJECTS, ...customSubjects];
}

// 保存自定义科目
function saveCustomSubject(subject) {
  if (DEFAULT_SUBJECTS.includes(subject)) return;

  const customSubjects = JSON.parse(localStorage.getItem('customSubjects') || '[]');
  if (!customSubjects.includes(subject)) {
    customSubjects.push(subject);
    localStorage.setItem('customSubjects', JSON.stringify(customSubjects));
  }
}

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

  // 添加任务
  document.getElementById('addTaskBtn')?.addEventListener('click', () => {
    showTaskModal();
  });

  // OCR拍照录入
  document.getElementById('ocrUploadBtn')?.addEventListener('click', () => {
    OCRUpload.triggerCamera();
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

      <div class="task-actions">
        <button class="btn-action btn-edit" data-id="${task.id}" title="编辑">✏️</button>
        <button class="btn-action btn-delete" data-id="${task.id}" title="删除">🗑️</button>
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

  // 编辑按钮
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = parseInt(e.target.dataset.id);
      const tasks = await AppState.loadTasksForDate(AppState.selectedDate);
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        showTaskModal(task);
      }
    });
  });

  // 删除按钮
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const taskId = parseInt(e.target.dataset.id);
      if (confirm('确定要删除这个任务吗？')) {
        try {
          await TaskAPI.delete(taskId);
          showToast('任务已删除', 'success');
          loadStudentData();
        } catch (err) {
          showToast('删除失败', 'error');
        }
      }
    });
  });
}

// 显示任务添加/编辑模态框
function showTaskModal(task = null) {
  const isEdit = task !== null;
  const allSubjects = getAllSubjects();
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>${isEdit ? '编辑任务' : '添加任务'}</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <form id="taskForm">
          <div class="form-group">
            <label>科目</label>
            <input type="text" id="taskSubject" list="taskSubjectDatalist" required
                   placeholder="点击选择或输入科目" autocomplete="off"
                   value="${task?.subject || ''}">
            <datalist id="taskSubjectDatalist">
              ${allSubjects.map(subject => `<option value="${subject}">${subject}</option>`).join('')}
            </datalist>
            <small style="color: #888; display: block; margin-top: 4px;">💡 点击输入框查看已有科目，或直接输入新科目名称</small>
          </div>
          <div class="form-group">
            <label>任务标题</label>
            <input type="text" id="taskTitle" required placeholder="例如：完成课后习题"
                   value="${task?.title || ''}">
          </div>
          <div class="form-group">
            <label>选择日期（可多选）</label>
            <div class="day-checkboxes">
              ${['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map((day, index) => `
                <label class="day-checkbox-item">
                  <input type="checkbox" name="taskDays" value="${index}" ${index < 5 ? 'checked' : ''}>
                  <span>${day}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="form-group">
            <label>类型</label>
            <select id="taskType">
              <option value="study" ${task?.type === 'study' ? 'selected' : ''}>学习</option>
              <option value="review" ${task?.type === 'review' ? 'selected' : ''}>复习</option>
              <option value="homework" ${task?.type === 'homework' ? 'selected' : ''}>作业</option>
              <option value="exercise" ${task?.type === 'exercise' ? 'selected' : ''}>运动</option>
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary modal-close-btn">取消</button>
            <button type="submit" class="btn btn-primary">${isEdit ? '保存' : '添加'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add active class to show the modal
  setTimeout(() => modal.classList.add('active'), 10);

  // 设置选中的科目
  if (task) {
    document.getElementById('taskSubject').value = task.subject;
  }

  // 关闭模态框
  const closeModal = () => {
    document.body.removeChild(modal);
  };

  modal.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // 科目输入框获得焦点时，全选文本方便查看下拉列表
  const subjectInput = document.getElementById('taskSubject');
  subjectInput.addEventListener('focus', function() {
    this.select();
  });

  // 表单提交
  document.getElementById('taskForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // 获取选中的日期
    const selectedDays = Array.from(document.querySelectorAll('input[name="taskDays"]:checked'))
      .map(cb => parseInt(cb.value));

    if (selectedDays.length === 0) {
      showToast('请至少选择一天', 'error');
      return;
    }

    // 获取本周的日期范围
    const weekStart = AppState.getWeekStart();
    const weekDates = DateUtils.getWeekDates(weekStart);

    // 获取科目并保存自定义科目
    const subject = document.getElementById('taskSubject').value.trim();
    if (!subject) {
      showToast('请输入科目', 'error');
      return;
    }
    saveCustomSubject(subject);

    // 为每个选中的日期创建任务
    const taskData = {
      subject: subject,
      title: document.getElementById('taskTitle').value,
      type: document.getElementById('taskType').value
    };

    try {
      if (isEdit) {
        // 编辑模式：先删除原任务，再创建新任务
        await TaskAPI.delete(task.id);
        for (const dayIndex of selectedDays) {
          await TaskAPI.create({
            ...taskData,
            date: weekDates[dayIndex]
          });
        }
        showToast(`任务已更新到 ${selectedDays.length} 天`, 'success');
      } else {
        // 创建模式：为每个选中的日期创建任务
        for (const dayIndex of selectedDays) {
          await TaskAPI.create({
            ...taskData,
            date: weekDates[dayIndex]
          });
        }
        showToast(`任务已添加到 ${selectedDays.length} 天`, 'success');
      }
      closeModal();
      loadStudentData();
    } catch (err) {
      showToast(isEdit ? '更新失败' : '添加失败', 'error');
    }
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
