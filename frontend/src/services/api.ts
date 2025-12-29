import axios from "axios";
import type { Project, ProjectMessage, Asset, VideoProject } from "../types";

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

  saveSelectedAssets: async (projectId: string, assetIds: string[]): Promise<void> => {
    await api.post(`/projects/${projectId}/select-assets`, { assetIds });
  },
};

export const assetsApi = {
  getAssets: async (projectId: string): Promise<Asset[]> => {
    const { data } = await api.get<Asset[]>(`/projects/${projectId}/assets`);
    return data;
  },

  getAsset: async (projectId: string, assetId: string): Promise<Asset> => {
    const { data } = await api.get<Asset>(`/projects/${projectId}/assets/${assetId}`);
    return data;
  },

  generate3DModel: async (projectId: string, assetId: string): Promise<{ success: boolean; meshy_id: string }> => {
    const { data } = await api.post<{ success: boolean; meshy_id: string }>(
      `/projects/${projectId}/assets/${assetId}/generate-3d`
    );
    return data;
  },

  check3DStatus: async (
    projectId: string,
    assetId: string
  ): Promise<{ status: string; progress: number; model_url?: string | null }> => {
    const { data } = await api.get<{ status: string; progress: number; model_url?: string | null }>(
      `/projects/${projectId}/assets/${assetId}/check-3d-status`
    );
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

  generateReports: async (projectId: string) => {
    const { data } = await api.post(`/projects/${projectId}/generate-reports`);
    return data;
  },

  getLayoutProgress: async (projectId: string) => {
    const { data } = await api.get(`/projects/${projectId}/layout-progress`);
    return data;
  },

  generateFullReport: async (projectId: string) => {
    const { data } = await api.post(`/projects/${projectId}/generate-full-report`);
    return data;
  },

  getFullReportStreamUrl: (projectId: string) => {
    return `${API_BASE_URL}/projects/${projectId}/generate-full-report/stream`;
  },

  getFullReportDownloadUrl: (projectId: string) => {
    return `${API_BASE_URL}/projects/${projectId}/full-report-pdf`;
  },
};

export const videoApi = {
  getVideos: async (projectId: string): Promise<VideoProject[]> => {
    const { data } = await api.get<VideoProject[]>(`/projects/${projectId}/videos`);
    return data;
  },

  getVideo: async (projectId: string, videoId: string): Promise<VideoProject> => {
    const { data } = await api.get<VideoProject>(`/projects/${projectId}/videos/${videoId}`);
    return data;
  },

  createVideo: async (projectId: string, title?: string, prompt?: string): Promise<VideoProject> => {
    const { data } = await api.post<VideoProject>(`/projects/${projectId}/videos`, { title, prompt });
    return data;
  },

  updateVideo: async (projectId: string, videoId: string, updates: Partial<VideoProject>): Promise<VideoProject> => {
    const { data } = await api.patch<VideoProject>(`/projects/${projectId}/videos/${videoId}`, updates);
    return data;
  },

  deleteVideo: async (projectId: string, videoId: string): Promise<void> => {
    await api.delete(`/projects/${projectId}/videos/${videoId}`);
  },

  getGenerateFramesStreamUrl: (projectId: string, videoId: string, frameType: "first" | "last" | "both" = "both") => {
    return `${API_BASE_URL}/projects/${projectId}/videos/${videoId}/generate-frames/stream?frame=${frameType}`;
  },

  getGenerateVideoStreamUrl: (projectId: string, videoId: string) => {
    return `${API_BASE_URL}/projects/${projectId}/videos/${videoId}/generate-video/stream`;
  },
};

