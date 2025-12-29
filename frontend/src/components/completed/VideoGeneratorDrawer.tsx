/**
 * VideoGeneratorDrawer - Create video promotional content with AI-generated frames
 * Note: Renamed internally to Dialog as per user request, but keeping file name for compatibility
 */

import React, { useState, useEffect } from "react";
import { 
  Button, 
  Text, 
  Badge,
  Input,
  Textarea,
  clx,
  IconButton,
} from "@medusajs/ui";
import { 
  Photo,
  Sparkles,
  ArrowDownTray,
  XMark,
  Plus,
  Trash,
} from "@medusajs/icons";
import type { VideoProject } from "../../types";
import { videoApi } from "../../services/api";

interface VideoGeneratorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  videoProject: VideoProject | null;
  onSave: (video: VideoProject) => void;
  onDelete?: (videoId: string) => void;
}

// Custom icons
function FilmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function VideoGeneratorDrawer({ 
  isOpen, 
  onClose, 
  projectId,
  videoProject,
  onSave,
  onDelete,
}: VideoGeneratorDrawerProps) {
  // Helper to convert file path to full URL
  const getImageUrl = (url: string | null): string | null => {
    if (!url) return null;
    // If it's already a data URL or full URL, return as is
    if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    // If it's a relative path, prepend API base URL
    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
    return `${apiBase}${url.startsWith("/") ? url : `/${url}`}`;
  };

  const [title, setTitle] = useState(videoProject?.title || "Untitled Video");
  
  // Prompt for last frame only
  const [lastFramePrompt, setLastFramePrompt] = useState(videoProject?.metadata?.last_frame_prompt || "");
  
  const [lastFrame, setLastFrame] = useState<string | null>(videoProject?.last_frame_url || null);
  const [videoUrl, setVideoUrl] = useState<string | null>(videoProject?.video_url || null);
  const [status, setStatus] = useState<VideoProject["status"]>(videoProject?.status || "draft");
  
  const [isGeneratingLastFrame, setIsGeneratingLastFrame] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(videoProject?.id || null);

  // Sync state when videoProject prop changes
  useEffect(() => {
    if (videoProject) {
      setTitle(videoProject.title);
      setLastFramePrompt(videoProject.metadata?.last_frame_prompt || "");
      setLastFrame(videoProject.last_frame_url);
      setVideoUrl(videoProject.video_url);
      setStatus(videoProject.status);
      setVideoId(videoProject.id);
      setHasChanges(false);
    } else {
      // Reset for new video
      setTitle("Untitled Video");
      setLastFramePrompt("");
      setLastFrame(null);
      setVideoUrl(null);
      setStatus("draft");
      setVideoId(null);
      setHasChanges(false);
    }
    setError(null);
  }, [videoProject, isOpen]);

  const handleGenerateFrame = async () => {
    if (!projectId) return;
    
    if (!lastFramePrompt.trim()) {
      setError("Please enter a prompt for the frame");
      return;
    }

    setError(null);
    setIsGeneratingLastFrame(true);

    try {
      // Create video project if it doesn't exist yet
      let currentVideoId = videoId;
      if (!currentVideoId) {
        const newVideo = await videoApi.createVideo(projectId, title, "");
        setVideoId(newVideo.id);
        currentVideoId = newVideo.id;
      }

      // Update metadata with prompt
      await videoApi.updateVideo(projectId, currentVideoId, {
        metadata: {
          ...videoProject?.metadata,
          last_frame_prompt: lastFramePrompt,
        }
      });

      const eventSource = new EventSource(
        videoApi.getGenerateFramesStreamUrl(projectId, currentVideoId, "last")
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "progress") {
          setGenerationProgress(data.message);
        } else if (data.type === "frame_complete") {
          setLastFrame(data.imageUrl);
          setIsGeneratingLastFrame(false);
          setStatus("frames_ready");
          setHasChanges(true);
        } else if (data.type === "frame_error") {
          setError(`Failed to generate frame: ${data.message}`);
          setIsGeneratingLastFrame(false);
        } else if (data.type === "complete") {
          setGenerationProgress("");
          eventSource.close();
        } else if (data.type === "error") {
          setError(data.message);
          setIsGeneratingLastFrame(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setError("Connection lost. Please try again.");
        setIsGeneratingLastFrame(false);
        setGenerationProgress("");
        eventSource.close();
      };

    } catch (err: any) {
      setError(err.message || "Failed to generate frame");
      setIsGeneratingLastFrame(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!projectId || !videoId || !lastFrame) return;

    setIsGeneratingVideo(true);
    setError(null);

    try {
      const eventSource = new EventSource(
        videoApi.getGenerateVideoStreamUrl(projectId, videoId)
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "progress") {
          setGenerationProgress(`${data.message} (${data.progress}%)`);
        } else if (data.type === "complete") {
          setVideoUrl(data.videoUrl);
          setStatus("completed");
          setIsGeneratingVideo(false);
          setGenerationProgress("");
          setHasChanges(true);
          eventSource.close();
        } else if (data.type === "error") {
          setError(data.message);
          setIsGeneratingVideo(false);
          setGenerationProgress("");
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setError("Connection lost. Please try again.");
        setIsGeneratingVideo(false);
        setGenerationProgress("");
        eventSource.close();
      };

    } catch (err: any) {
      setError(err.message || "Failed to generate video");
      setIsGeneratingVideo(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      let savedVideo: VideoProject;
      
      // Ensure metadata is always an object
      const existingMetadata = videoProject?.metadata || {};
      const metadata = {
        ...existingMetadata,
        last_frame_prompt: lastFramePrompt,
      };

      if (videoId) {
        // Update existing
        savedVideo = await videoApi.updateVideo(projectId, videoId, {
          title,
          last_frame_url: lastFrame,
          video_url: videoUrl,
          status,
          metadata,
        });
      } else {
        // Create new
        savedVideo = await videoApi.createVideo(projectId, title, "");
        // Update metadata separately since create only takes basic fields
        savedVideo = await videoApi.updateVideo(projectId, savedVideo.id, { metadata });
        setVideoId(savedVideo.id);
      }
      
      setHasChanges(false);
      onSave(savedVideo);
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!videoId || !onDelete) return;
    
    if (!confirm("Are you sure you want to delete this video project?")) return;

    try {
      await videoApi.deleteVideo(projectId, videoId);
      onDelete(videoId);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    }
  };

  const isGenerating = isGeneratingLastFrame || isGeneratingVideo;
  const canGenerateVideo = lastFrame && !isGenerating;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-ui-bg-base w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-ui-border-base">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-ui-border-base bg-ui-bg-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <FilmIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Video Title"
                className="text-lg font-semibold border-none p-0 bg-transparent shadow-none focus:ring-0 h-auto"
              />
              <Text size="small" className="text-ui-fg-subtle">
                {status === "completed" ? "Video Ready" : 
                 status === "frames_ready" ? "Frames Generated" :
                 status === "video_generating" ? "Generating Video..." :
                 status === "frames_generating" ? "Generating Frames..." :
                 "Draft Project"}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {videoId && onDelete && (
              <IconButton
                variant="transparent"
                onClick={handleDelete}
                className="text-ui-fg-error hover:bg-ui-tag-red-bg"
              >
                <Trash className="w-5 h-5" />
              </IconButton>
            )}
            <IconButton
              variant="transparent"
              onClick={onClose}
              className="text-ui-fg-subtle hover:text-ui-fg-base"
            >
              <XMark className="w-6 h-6" />
            </IconButton>
          </div>
        </div>

        {/* Body - Single Frame View */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* Frame Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge color="purple" size="small">Video Frame</Badge>
                  <Text size="small" className="text-ui-fg-muted">Promotional Image</Text>
                </div>
              </div>

              {/* Image Area */}
              <div className="aspect-video rounded-xl border border-ui-border-base bg-ui-bg-subtle flex items-center justify-center relative overflow-hidden group">
                {isGeneratingLastFrame ? (
                  <div className="text-center p-4">
                    <div className="w-10 h-10 mx-auto mb-3 rounded-full border-4 border-ui-border-base border-t-purple-500 animate-spin" />
                    <Text size="small" className="text-ui-fg-subtle">Generating...</Text>
                  </div>
                ) : lastFrame ? (
                  <>
                    <img 
                      src={getImageUrl(lastFrame) || ""} 
                      alt="Video Frame" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        variant="secondary"
                        onClick={handleGenerateFrame}
                        disabled={isGenerating}
                        className="gap-2"
                      >
                        <RefreshIcon className="w-4 h-4" />
                        Regenerate
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6">
                    <Photo className="w-12 h-12 text-ui-fg-muted mx-auto mb-2 opacity-50" />
                    <Text className="text-ui-fg-muted">No frame generated</Text>
                  </div>
                )}
              </div>

              {/* Prompt Input */}
              <div className="space-y-2">
                <Text size="small" weight="plus" className="text-ui-fg-subtle">
                  Prompt
                </Text>
                <Textarea
                  value={lastFramePrompt}
                  onChange={(e) => {
                    setLastFramePrompt(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="Describe the scene... (e.g., 'Busy production floor with workers and machinery in action, professional lighting')"
                  rows={3}
                  className="resize-none"
                />
                <Button 
                  variant="secondary" 
                  className="w-full mt-2"
                  onClick={handleGenerateFrame}
                  disabled={isGenerating || !lastFramePrompt.trim()}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Frame
                </Button>
              </div>
            </div>

          </div>

          {/* Video Generation Section */}
          <div className="mt-8 pt-8 border-t border-ui-border-base">
            {lastFrame && (
              <div className="rounded-xl border-2 border-dashed border-ui-border-strong p-6 bg-gradient-to-br from-ui-bg-subtle to-ui-bg-base">
                {videoUrl ? (
                  <div className="flex flex-col md:flex-row gap-6 items-center">
                    <div className="w-full md:w-1/2 rounded-lg overflow-hidden border border-ui-border-base shadow-lg">
                      <video 
                        src={videoUrl} 
                        controls 
                        className="w-full"
                        poster={getImageUrl(lastFrame) || undefined}
                      />
                    </div>
                    <div className="w-full md:w-1/2 space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge color="green">
                          <SparkleIcon className="w-3 h-3 mr-1" />
                          Video Generated Successfully
                        </Badge>
                      </div>
                      <Text className="text-ui-fg-subtle">
                        Your professional factory video is ready. You can download it or regenerate to try a different style.
                      </Text>
                      <div className="flex flex-wrap gap-3">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            const link = document.createElement("a");
                            link.href = videoUrl;
                            link.download = `${title.replace(/\s+/g, "_")}.mp4`;
                            link.click();
                          }}
                          className="gap-2"
                        >
                          <ArrowDownTray className="w-4 h-4" />
                          Download MP4
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setVideoUrl(null);
                            setStatus("frames_ready");
                          }}
                          className="gap-2"
                        >
                          <RefreshIcon className="w-4 h-4" />
                          Regenerate Video
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : isGeneratingVideo ? (
                  <div className="text-center py-8">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-rose-500 animate-spin" style={{ animationDuration: "2s" }} />
                      <div className="absolute inset-1 rounded-full bg-ui-bg-base flex items-center justify-center">
                        <FilmIcon className="w-6 h-6 text-pink-500" />
                      </div>
                    </div>
                    <Text weight="plus" className="mb-1">Generating Video</Text>
                    <Text size="small" className="text-ui-fg-subtle">{generationProgress || "Creating video from frame..."}</Text>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Text weight="plus" className="mb-1 block">
                      {canGenerateVideo ? "Ready to Generate Video" : "Generate Frame First"}
                    </Text>
                    <Text size="small" className="text-ui-fg-subtle mb-4 block">
                      Create an AI-generated video from your frame
                    </Text>
                    <Button
                      variant="primary"
                      size="large"
                      onClick={handleGenerateVideo}
                      disabled={!canGenerateVideo}
                      className="gap-2 px-8"
                    >
                      <PlayIcon className="w-4 h-4" />
                      Generate Video
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 rounded-xl bg-ui-tag-red-bg border border-ui-tag-red-border flex items-start gap-3">
              <XMark className="w-5 h-5 text-ui-tag-red-icon flex-shrink-0 mt-0.5" />
              <div>
                <Text className="text-ui-tag-red-text font-medium">{error}</Text>
                <Button
                  variant="secondary"
                  size="small"
                  className="mt-2"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ui-border-base bg-ui-bg-subtle flex justify-between items-center">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-3">
            {hasChanges && (
              <Text size="small" className="text-ui-fg-muted">Unsaved changes</Text>
            )}
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving || isGenerating}
            >
              {isSaving ? "Saving..." : videoId ? "Save Changes" : "Save Draft"}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
