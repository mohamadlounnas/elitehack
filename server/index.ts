/**
 * Express server for Production Line Planning System
 * Main entry point for the backend API
 */

import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Import routes
import projectRoutes from './routes/projects.js';
import chatRoutes from './routes/chat.js';
import machineRoutes from './routes/machines.js';
import workflowRoutes from './routes/workflow.js';

// API Routes
app.use('/api/projects', projectRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/workflow', workflowRoutes);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  console.error('Error:', err);
  res.status((err as { status?: number })?.status || 500).json({
    error: (err as Error).message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: (err as Error).stack }),
  });
};

app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

