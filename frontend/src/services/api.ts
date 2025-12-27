import axios from "axios";
import type { Project, ProjectMessage, Asset } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const projectsApi = {
  create: async (name: string, description?: string): Promise<Project> => {
    const { data } = await api.post<Project>("/projects", { name, description });
    return data;
  },

  get: async (id: string): Promise<Project> => {
    const { data } = await api.get<Project>(`/projects/${id}`);
    return data;
  },

  getAll: async (): Promise<Project[]> => {
    const { data } = await api.get<Project[]>("/projects");
    return data;
  },

  getStatus: async (id: string) => {
    const { data } = await api.get(`/projects/${id}/status`);
    return data;
  },
};

export const chatApi = {
  sendMessage: async (projectId: string, content: string, attachments?: File[]): Promise<ProjectMessage> => {
    const formData = new FormData();
    formData.append("content", content);
    if (attachments) {
      attachments.forEach((file) => {
        formData.append("attachments", file);
      });
    }
    const { data } = await api.post<ProjectMessage>(
      `/projects/${projectId}/chat`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    return data;
  },

  getMessages: async (projectId: string): Promise<ProjectMessage[]> => {
    const { data } = await api.get<ProjectMessage[]>(`/projects/${projectId}/messages`);
    return data;
  },
};

export const planningApi = {
  startPlanning: async (projectId: string): Promise<void> => {
    await api.post(`/projects/${projectId}/start-planning`);
  },

  retryStep: async (projectId: string): Promise<void> => {
    await api.post(`/projects/${projectId}/retry-step`);
  },

  nextStep: async (projectId: string): Promise<void> => {
    await api.post(`/projects/${projectId}/next-step`);
  },

  prevStep: async (projectId: string): Promise<void> => {
    await api.post(`/projects/${projectId}/prev-step`);
  },
};

export const assetsApi = {
  getAssets: async (projectId: string): Promise<Asset[]> => {
    const { data } = await api.get<Asset[]>(`/projects/${projectId}/assets`);
    return data;
  },
};

export const dataApi = {
  getSuppliers: async (projectId: string) => {
    const { data } = await api.get(`/projects/${projectId}/suppliers`);
    return data;
  },

  getGeneratedFiles: async (projectId: string) => {
    const { data } = await api.get(`/projects/${projectId}/generated-files`);
    return data;
  },

  getTCO: async (projectId: string) => {
    const { data } = await api.get(`/projects/${projectId}/tco`);
    return data;
  },

  getLayoutProgress: async (projectId: string) => {
    const { data } = await api.get(`/projects/${projectId}/layout-progress`);
    return data;
  },
};

