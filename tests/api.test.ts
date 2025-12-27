/**
 * Basic API tests
 * Run with: npm test
 */

import { describe, it, expect, beforeAll } from '@jest/globals';

describe('API Health Check', () => {
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

  it('should respond to health check', async () => {
    const response = await fetch(`${API_BASE}/health`);
    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});

describe('Projects API', () => {
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

  it('should get all projects', async () => {
    const response = await fetch(`${API_BASE}/api/projects`);
    expect(response.ok).toBe(true);
    const projects = await response.json();
    expect(Array.isArray(projects)).toBe(true);
  });

  it('should create a project', async () => {
    const response = await fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Project', description: 'Test Description' }),
    });
    expect(response.ok).toBe(true);
    const project = await response.json();
    expect(project.name).toBe('Test Project');
  });
});

