/**
 * Chat API routes
 * Handles chat interactions and workflow execution
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { executeProjectWorkflow } from '../workflows/projectWorkflow.js';
import { getConversationHistory } from '../services/chatService.js';
import { getProject } from '../services/projectService.js';

const router: Router = express.Router();

/**
 * POST /api/chat/:projectId
 * Send message to project chat and execute workflow
 */
router.post('/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { message, attachments } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Execute workflow (handles chat and status transitions)
    const result = await executeProjectWorkflow(projectId, message);

    // Get updated project status
    const updatedProject = await getProject(projectId);

    res.json({
      message: result.message,
      projectStatus: result.projectStatus || updatedProject.status,
      machinesCreated: result.machinesCreated,
      status: result.status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/chat/:projectId/history
 * Get conversation history for a project
 */
router.get('/:projectId/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const history = await getConversationHistory(projectId);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

export default router;

