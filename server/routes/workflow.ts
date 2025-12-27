/**
 * Workflow API routes
 * Handles manual workflow step triggering
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { triggerWorkflowStep } from '../workflows/projectWorkflow.js';
import { getProject } from '../services/projectService.js';

const router: Router = express.Router();

/**
 * POST /api/workflow/:projectId/trigger-step
 * Manually trigger workflow step transition
 */
router.post('/:projectId/trigger-step', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const { targetStep } = req.body;

    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Trigger workflow step
    const result = await triggerWorkflowStep(projectId, targetStep);

    res.json({
      message: result.message,
      projectStatus: result.projectStatus,
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

