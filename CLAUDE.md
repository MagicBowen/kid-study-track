# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

高中生课外任务进度跟踪打卡系统 - An online task tracking and check-in system for high school students to manage their extracurricular study tasks.

**核心功能 (Core Features)**:
- 每日/每周任务计划与跟踪 (Daily/weekly task planning and tracking)
- 计划调整与执行记录 (Plan adjustment and execution tracking)
- 打印跟踪表，手动填写后拍照自动识别录入 (Print tracking tables, photo OCR for data entry)
- 数据持久化，支持离线运行 (Data persistence, offline capable)
- 一键启动/关闭 (One-click start/stop)

## Tech Stack

**Backend**: Node.js + Express
**Frontend**: HTML + CSS + Vanilla JavaScript (no framework)
**Database**: SQLite (for persistence, single-file database)
**OCR**: Tesseract.js (browser-based OCR for photo uploads)
**Package Manager**: npm

## Quick Start

```bash
# Install dependencies
npm install

# Start the server (one-click)
npm start

# Or with development mode (auto-restart on changes)
npm run dev

# Stop the server
Ctrl+C or npm run stop
```

The server runs on `http://localhost:3000` by default.

## Project Structure

```
kids/
├── src/
│   ├── server.js          # Express server entry point
│   ├── routes/            # API routes
│   │   ├── tasks.js       # Task CRUD operations
│   │   ├── plans.js       # Plan management
│   │   └── upload.js      # Photo upload & OCR
│   ├── models/            # Database models (SQLite)
│   │   └── database.js    # DB connection & schema
│   ├── public/            # Static frontend files
│   │   ├── index.html     # Main dashboard
│   │   ├── css/           # Stylesheets
│   │   └── js/            # Frontend JavaScript
│   └── utils/             # Helper functions
├── data/
│   └── tasks.db           # SQLite database (auto-created)
├── uploads/               # Uploaded photos
├── package.json
└── CLAUDE.md
```

## Development Commands

```bash
# Run tests
npm test

# Lint code
npm run lint

# Reset database (CAUTION: deletes all data)
npm run db:reset

# Backup database
npm run db:backup
```

## Data Persistence

- **Database**: SQLite stored in `data/tasks.db`
- **Backups**: Automatic backups on server start in `data/backups/`
- **Photos**: Stored in `uploads/` directory

## API Endpoints

```
GET    /api/tasks          # Get all tasks
POST   /api/tasks          # Create new task
PUT    /api/tasks/:id      # Update task
DELETE /api/tasks/:id      # Delete task
POST   /api/tasks/:id/complete  # Mark task as complete

GET    /api/plans          # Get weekly plan
POST   /api/plans          # Create/update plan
GET    /api/plans/print    # Generate printable HTML

POST   /api/upload/photo   # Upload photo for OCR
GET    /api/stats/week     # Weekly statistics
```

## Key Features Implementation

### 1. Task Management
- Tasks are organized by subject (数学, 物理, 化学, 生物, 语文, 英语)
- Each task has: title, description, deadline, status, timeSpent
- Supports recurring tasks (daily, weekly)

### 2. Plan Adjustment
- Students can modify their weekly plan
- Changes are logged with timestamps
- Template system for quick plan creation

### 3. Photo OCR
- User uploads photo of filled tracking table
- Tesseract.js extracts checkbox states and handwritten text
- Server validates and updates database
- Fallback to manual entry if OCR confidence is low

### 4. Print Support
- Generate printer-friendly HTML based on current plan
- Include QR code linking back to the system for status sync
- Support both landscape (schedule.html style) and portrait (周计划表格.html style) formats

## Architecture Notes

1. **Server Design**: Single Express server serving both API and static files
2. **Database Schema**: Simple relational design with tables for `tasks`, `plans`, `subjects`, `activity_logs`
3. **Frontend Architecture**: Component-based vanilla JS, no build step required
4. **State Management**: Local state + server sync via REST API
5. **Offline Support**: Service worker for caching (future enhancement)

## Configuration

Configuration in `config.json`:
```json
{
  "port": 3000,
  "dbPath": "./data/tasks.db",
  "uploadPath": "./uploads",
  "backupPath": "./data/backups",
  "ocrLanguage": "chi_sim+eng"
}
```

