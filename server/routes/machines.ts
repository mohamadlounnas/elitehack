/**
 * Machines API routes
 * Handles machine operations
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import {
  getProjectMachines,
  updateMachineStatus,
  retryMachineGeneration,
} from '../services/machineService.js';
import { getProject } from '../services/projectService.js';
import { MachineStatus } from '../types/index.js';

const router: Router = express.Router();

/**
 * GET /api/machines/project/:projectId
 * Get all machines for a project
 */
router.get('/project/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    
    // Verify project exists
    const project = await getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const machines = await getProjectMachines(projectId);
    res.json(machines);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/machines/:id/status
 * Update machine status (manual override)
 */
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, ...updates } = req.body;
    const machine = await updateMachineStatus(req.params.id, status as MachineStatus, updates);
    res.json(machine);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/machines/:id/retry
 * Retry machine generation
 */
router.post('/:id/retry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await retryMachineGeneration(req.params.id);
    res.json({ message: 'Retry initiated' });
  } catch (error) {
    next(error);
  }
});

export default router;

