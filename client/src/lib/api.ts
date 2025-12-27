/**
 * API client for backend communication
 */

import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

const client = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Projects
  async getProjects() {
    const response = await client.get('/api/projects');
    return response.data;
  },

  async getProject(id: string) {
    const response = await client.get(`/api/projects/${id}`);
    return response.data;
  },

  async createProject(data: { name: string; description: string }) {
    const response = await client.post('/api/projects', data);
    return response.data;
  },

  // Chat
  async getChatHistory(projectId: string) {
    const response = await client.get(`/api/chat/${projectId}/history`);
    return response.data;
  },

  async sendChatMessage(projectId: string, message: string) {
    const response = await client.post(`/api/chat/${projectId}`, { message });
    return response.data;
  },

  // Machines
  async getMachines(projectId: string) {
    const response = await client.get(`/api/machines/project/${projectId}`);
    return response.data;
  },
};

