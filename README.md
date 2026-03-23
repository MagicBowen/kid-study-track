# kid-study-track

A task tracking and check-in system designed for high school students to manage their extracurricular study tasks.

> **高中生课外任务进度跟踪打卡系统** - An online task tracking and check-in system for high school students to manage their extracurricular study tasks.

## Features

- 📅 **Daily/Weekly Task Planning** - Plan and track tasks by day or week
- ✅ **Task Completion Tracking** - Mark tasks as complete with time tracking
- 👁️ **Parent View** - Statistics and progress overview for parents
- 📄 **PDF Export** - Generate printable weekly tracking sheets
- ➕ **Custom Subjects** - Add custom subjects beyond the default ones
- 📱 **Offline Capable** - Works offline with local SQLite database
- 🖨️ **Print Support** - Print-friendly layouts for tracking sheets

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: HTML + CSS + Vanilla JavaScript (no framework)
- **Database**: SQLite (single-file database for easy setup)
- **Package Manager**: npm

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/kid-study-track.git
cd kid-study-track

# Install dependencies
npm install

# Start the server
npm start

# Or with development mode (auto-restart on changes)
npm run dev
```

The server runs on `http://localhost:3000` by default.

## Usage

### Student View

1. **View Tasks** - See tasks for the selected day
2. **Complete Tasks** - Check the checkbox when done, optionally add start/end times
3. **Add Notes** - Record learning content, difficulties, etc.
4. **Add Tasks** - Click "添加任务" to create new tasks
5. **Edit/Delete** - Use ✏️ to edit or 🗑️ to delete tasks
6. **Export PDF** - Click "导出PDF" to generate a printable tracking sheet

### Parent View

1. **View Statistics** - See weekly summary (total hours, completion rate)
2. **Daily Trend** - Visual chart of daily study time
3. **Subject Details** - Click on any subject to see detailed breakdown

## Project Structure

```
kid-study-track/
├── src/
│   ├── server.js          # Express server entry point
│   ├── routes/            # API routes
│   │   ├── tasks.js       # Task CRUD operations
│   │   ├── plans.js       # Plan management
│   │   ├── stats.js       # Statistics endpoints
│   │   └── export.js      # PDF export (print view)
│   ├── models/            # Database models
│   │   └── database.js    # SQLite database connection
│   ├── public/            # Frontend files
│   │   ├── index.html     # Main HTML
│   │   ├── css/           # Stylesheets
│   │   └── js/            # Frontend JavaScript
│   └── utils/             # Helper functions
├── data/                  # Database storage
│   ├── tasks.db          # SQLite database (auto-created)
│   └── backups/          # Database backups
├── uploads/              # Uploaded photos
├── package.json
├── README.md
└── LICENSE
```

## API Endpoints

### Tasks
- `GET /api/tasks?date=YYYY-MM-DD` - Get tasks for a specific date
- `POST /api/tasks` - Create a new task
- `PUT /api/tasks/:id` - Update a task
- `DELETE /api/tasks/:id` - Delete a task
- `POST /api/tasks/:id/complete` - Mark task as complete

### Statistics
- `GET /api/stats/week?weekStart=YYYY-MM-DD` - Get weekly statistics
- `GET /api/stats/subject?subject=X&weekStart=YYYY-MM-DD` - Get subject details

### Export
- `GET /api/export/print?weekStart=YYYY-MM-DD` - Generate print-friendly HTML

## Default Subjects

- 数学 (Math) 📐
- 物理 (Physics) ⚛️
- 化学 (Chemistry) 🧪
- 生物 (Biology) 🧬
- 语文 (Chinese) 📖
- 英语 (English) 📝
- 运动 (Sports) 🏃

Custom subjects can be added when creating tasks.

## Development

```bash
# Run tests
npm test

# Reset database (CAUTION: deletes all data)
npm run db:reset

# Backup database
npm run db:backup
```

## Configuration

The application uses the following default configuration:

- **Port**: 3000
- **Database**: `./data/tasks.db`
- **Upload Path**: `./uploads`

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions, please open an issue on GitHub.

---

Made with ❤️ for students and parents
