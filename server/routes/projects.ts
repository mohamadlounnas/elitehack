/**
 * Projects API routes
 * Handles project CRUD operations
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import {
  createProject,
  getProject,
  getAllProjects,
  updateProjectStatus,
} from '../services/projectService.js';
import { ProjectStatus } from '../types/index.js';

const router: Router = express.Router();

/**
 * GET /api/projects
 * Get all projects
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await getAllProjects();
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/projects/:id
 * Get project by ID
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await getProject(req.params.id);
    res.json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/projects
 * Create new project
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await createProject(name, description || '');
    res.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/projects/:id/status
 * Update project status (manual override if needed)
 */
router.patch('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, resultData } = req.body;
    const project = await updateProjectStatus(req.params.id, status as ProjectStatus, resultData);
    res.json(project);
  } catch (error) {
    next(error);
  }
});

export default router;

