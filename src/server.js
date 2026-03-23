const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const config = require('../config.json');
const database = require('./database');

const app = express();
const PORT = config.server.port;
const HOST = config.server.host;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/export', require('./routes/export'));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);

  // Structured JSON error response
  const errorResponse = {
    success: false,
    error: {
      code: err.code || 'UNKNOWN_ERROR',
      message: err.message || 'An unexpected error occurred'
    }
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error.stack = err.stack;
  }

  res.status(err.status || 500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`
    }
  });
});

// Server startup
async function start() {
  try {
    // Initialize database
    console.log('📦 Initializing database...');
    await database.initialize();
    console.log('✅ Database initialized');

    // Create tables
    console.log('📋 Creating database tables...');
    await database.createTables();
    console.log('✅ Database tables ready');

    // Start server
    const server = app.listen(PORT, HOST, () => {
      console.log('');
      console.log('🚀 Server running at http://localhost:' + PORT);
      console.log('📚 Student view: http://localhost:' + PORT);
      console.log('👁️  Parent view: http://localhost:' + PORT + '#parent');
      console.log('');
      console.log('Press Ctrl+C to stop the server');
      console.log('');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('');
      console.log('🛑 Shutting down...');

      // Close server
      server.close(async () => {
        try {
          // Close database
          await database.close();
          console.log('✅ Database closed');
          console.log('👋 Goodbye!');
          process.exit(0);
        } catch (err) {
          console.error('❌ Error during shutdown:', err);
          process.exit(1);
        }
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
start();

module.exports = app;
