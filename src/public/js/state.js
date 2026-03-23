// 应用状态管理
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

  // 事件监听器
  listeners: [],

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

  // 注册事件监听器
  on(event, callback) {
    this.listeners.push({ event, callback });
  },

  // 通知事件监听器
  notifyListeners(event) {
    this.listeners
      .filter(l => l.event === event)
      .forEach(l => l.callback());
  }
};
