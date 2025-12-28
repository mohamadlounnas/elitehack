/**
 * VideoGeneratorDrawer - Create video promotional content with AI-generated frames
 */

import React, { useState, useEffect } from "react";
import { 
  Drawer, 
  Button, 
  Text, 
  Badge,
  Input,
  Textarea,
  clx,
} from "@medusajs/ui";
import { 
  Photo,
  Sparkles,
  ArrowDownTray,
  XMark,
  Plus,
  Play,
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

export function VideoGeneratorDrawer({ 
  isOpen, 
  onClose, 
  projectId,
  videoProject,
  onSave,
  onDelete,
}: VideoGeneratorDrawerProps) {
  const [title, setTitle] = useState(videoProject?.title || "Untitled Video");
  const [prompt, setPrompt] = useState(videoProject?.prompt || "");
  const [firstFrame, setFirstFrame] = useState<string | null>(videoProject?.first_frame_url || null);
  const [lastFrame, setLastFrame] = useState<string | null>(videoProject?.last_frame_url || null);
  const [videoUrl, setVideoUrl] = useState<string | null>(videoProject?.video_url || null);
  const [status, setStatus] = useState<VideoProject["status"]>(videoProject?.status || "draft");
  
  const [isGeneratingFirstFrame, setIsGeneratingFirstFrame] = useState(false);
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
      setPrompt(videoProject.prompt || "");
      setFirstFrame(videoProject.first_frame_url);
      setLastFrame(videoProject.last_frame_url);
      setVideoUrl(videoProject.video_url);
      setStatus(videoProject.status);
      setVideoId(videoProject.id);
      setHasChanges(false);
    } else {
      // Reset for new video
      setTitle("Untitled Video");
      setPrompt("");
      setFirstFrame(null);
      setLastFrame(null);
      setVideoUrl(null);
      setStatus("draft");
      setVideoId(null);
      setHasChanges(false);
    }
    setError(null);
  }, [videoProject, isOpen]);

  const handleGenerateFrame = async (frameType: "first" | "last") => {
    if (!projectId) return;
    
    setError(null);
    
    if (frameType === "first") {
      setIsGeneratingFirstFrame(true);
    } else {
      setIsGeneratingLastFrame(true);
    }

    try {
      // Create video project if it doesn't exist yet
      let currentVideoId = videoId;
      if (!currentVideoId) {
        const newVideo = await videoApi.createVideo(projectId, title, prompt);
        setVideoId(newVideo.id);
        currentVideoId = newVideo.id;
      } else {
        // Update prompt if changed
        if (prompt !== videoProject?.prompt) {
          await videoApi.updateVideo(projectId, currentVideoId, { prompt });
        }
      }

      const eventSource = new EventSource(
        videoApi.getGenerateFramesStreamUrl(projectId, currentVideoId, frameType)
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "progress") {
          setGenerationProgress(data.message);
        } else if (data.type === "frame_complete") {
          if (data.frame === "first") {
            setFirstFrame(data.imageUrl);
            setIsGeneratingFirstFrame(false);
          } else {
            setLastFrame(data.imageUrl);
            setIsGeneratingLastFrame(false);
          }
          setStatus("frames_ready");
          setHasChanges(true);
        } else if (data.type === "frame_error") {
          setError(`Failed to generate ${data.frame} frame: ${data.message}`);
          if (data.frame === "first") {
            setIsGeneratingFirstFrame(false);
          } else {
            setIsGeneratingLastFrame(false);
          }
        } else if (data.type === "complete") {
          setGenerationProgress("");
          eventSource.close();
        } else if (data.type === "error") {
          setError(data.message);
          setIsGeneratingFirstFrame(false);
          setIsGeneratingLastFrame(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setError("Connection lost. Please try again.");
        setIsGeneratingFirstFrame(false);
        setIsGeneratingLastFrame(false);
        setGenerationProgress("");
        eventSource.close();
      };

    } catch (err: any) {
      setError(err.message || "Failed to generate frame");
      setIsGeneratingFirstFrame(false);
      setIsGeneratingLastFrame(false);
    }
  };

  const handleGenerateVideo = async () => {
    if (!projectId || !videoId || !firstFrame || !lastFrame) return;

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
      
      if (videoId) {
        // Update existing
        savedVideo = await videoApi.updateVideo(projectId, videoId, {
          title,
          prompt,
          first_frame_url: firstFrame,
          last_frame_url: lastFrame,
          video_url: videoUrl,
          status,
        });
      } else {
        // Create new
        savedVideo = await videoApi.createVideo(projectId, title, prompt);
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

  const isGenerating = isGeneratingFirstFrame || isGeneratingLastFrame || isGeneratingVideo;
  const canGenerateVideo = firstFrame && lastFrame && !isGenerating;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content className="max-w-4xl">
        <Drawer.Header>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <FilmIcon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Video Title"
                className="text-lg font-semibold border-none p-0 bg-transparent"
              />
              <Text size="small" className="text-ui-fg-subtle">
                {status === "completed" ? "Video Ready" : 
                 status === "frames_ready" ? "Frames Generated" :
                 status === "video_generating" ? "Generating Video..." :
                 status === "frames_generating" ? "Generating Frames..." :
                 "Draft"}
              </Text>
            </div>
            {videoId && onDelete && (
              <Button
                variant="secondary"
                size="small"
                onClick={handleDelete}
                className="text-ui-fg-error hover:bg-ui-tag-red-bg"
              >
                <Trash className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Drawer.Header>

        <Drawer.Body className="p-6 space-y-6">
          {/* Frames Split View */}
          <div className="grid grid-cols-2 gap-4">
            {/* First Frame */}
            <div className="rounded-xl border border-ui-border-base overflow-hidden">
              <div className="p-3 border-b border-ui-border-base bg-ui-bg-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge color="blue" size="small">First Frame</Badge>
                  <Text size="xsmall" className="text-ui-fg-muted">Opening Shot</Text>
                </div>
              </div>
              <div className="aspect-video bg-ui-bg-subtle flex items-center justify-center relative">
                {isGeneratingFirstFrame ? (
                  <div className="text-center p-4">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-ui-border-base border-t-pink-500 animate-spin" />
                    <Text size="small" className="text-ui-fg-subtle">Generating...</Text>
                    {generationProgress && (
                      <Text size="xsmall" className="text-ui-fg-muted mt-1">{generationProgress}</Text>
                    )}
                  </div>
                ) : firstFrame ? (
                  <>
                    <img 
                      src={firstFrame} 
                      alt="First Frame" 
                      className="max-w-full max-h-full object-contain"
                    />
                    <button
                      onClick={() => handleGenerateFrame("first")}
                      disabled={isGenerating}
                      className="absolute bottom-2 right-2 p-2 rounded-lg bg-ui-bg-base/80 hover:bg-ui-bg-base text-ui-fg-subtle hover:text-ui-fg-base transition-colors"
                      title="Regenerate"
                    >
                      <RefreshIcon className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleGenerateFrame("first")}
                    disabled={isGenerating || !prompt}
                    className={clx(
                      "flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed transition-colors",
                      !prompt 
                        ? "border-ui-border-base text-ui-fg-disabled cursor-not-allowed"
                        : "border-ui-border-strong hover:border-pink-500 text-ui-fg-muted hover:text-pink-500"
                    )}
                  >
                    <Sparkles className="w-8 h-8" />
                    <Text size="small">Generate First Frame</Text>
                  </button>
                )}
              </div>
            </div>

            {/* Last Frame */}
            <div className="rounded-xl border border-ui-border-base overflow-hidden">
              <div className="p-3 border-b border-ui-border-base bg-ui-bg-subtle flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge color="purple" size="small">Last Frame</Badge>
                  <Text size="xsmall" className="text-ui-fg-muted">Closing Shot</Text>
                </div>
              </div>
              <div className="aspect-video bg-ui-bg-subtle flex items-center justify-center relative">
                {isGeneratingLastFrame ? (
                  <div className="text-center p-4">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full border-4 border-ui-border-base border-t-purple-500 animate-spin" />
                    <Text size="small" className="text-ui-fg-subtle">Generating...</Text>
                    {generationProgress && (
                      <Text size="xsmall" className="text-ui-fg-muted mt-1">{generationProgress}</Text>
                    )}
                  </div>
                ) : lastFrame ? (
                  <>
                    <img 
                      src={lastFrame} 
                      alt="Last Frame" 
                      className="max-w-full max-h-full object-contain"
                    />
                    <button
                      onClick={() => handleGenerateFrame("last")}
                      disabled={isGenerating}
                      className="absolute bottom-2 right-2 p-2 rounded-lg bg-ui-bg-base/80 hover:bg-ui-bg-base text-ui-fg-subtle hover:text-ui-fg-base transition-colors"
                      title="Regenerate"
                    >
                      <RefreshIcon className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleGenerateFrame("last")}
                    disabled={isGenerating || !prompt}
                    className={clx(
                      "flex flex-col items-center gap-2 p-6 rounded-xl border-2 border-dashed transition-colors",
                      !prompt 
                        ? "border-ui-border-base text-ui-fg-disabled cursor-not-allowed"
                        : "border-ui-border-strong hover:border-purple-500 text-ui-fg-muted hover:text-purple-500"
                    )}
                  >
                    <Sparkles className="w-8 h-8" />
                    <Text size="small">Generate Last Frame</Text>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <Text size="small" weight="plus" className="text-ui-fg-subtle">
              Video Prompt
            </Text>
            <Textarea
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Describe what you want to see in your promotional video... (e.g., 'Show our advanced production line with workers operating cutting-edge machinery')"
              rows={3}
              className="resize-none"
            />
            <Text size="xsmall" className="text-ui-fg-muted">
              The AI will use your factory layout, equipment, and this prompt to generate cinematic frames.
            </Text>
          </div>

          {/* Generate Video Button */}
          {(firstFrame || lastFrame) && (
            <div className="rounded-xl border-2 border-dashed border-ui-border-strong p-6 text-center bg-gradient-to-br from-ui-bg-subtle to-ui-bg-base">
              {videoUrl ? (
                <div className="space-y-4">
                  <div className="rounded-lg overflow-hidden border border-ui-border-base">
                    <video 
                      src={videoUrl} 
                      controls 
                      className="w-full"
                      poster={firstFrame || undefined}
                    />
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <Badge color="green" size="small">
                      <SparkleIcon className="w-3 h-3 mr-1" />
                      Video Generated
                    </Badge>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = videoUrl;
                        link.download = `${title.replace(/\s+/g, "_")}.mp4`;
                        link.click();
                      }}
                    >
                      <ArrowDownTray className="w-4 h-4" />
                      Download
                    </Button>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => {
                        setVideoUrl(null);
                        setStatus("frames_ready");
                      }}
                    >
                      <RefreshIcon className="w-4 h-4" />
                      Regenerate
                    </Button>
                  </div>
                </div>
              ) : isGeneratingVideo ? (
                <div className="py-8">
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-rose-500 animate-spin" style={{ animationDuration: "2s" }} />
                    <div className="absolute inset-1 rounded-full bg-ui-bg-base flex items-center justify-center">
                      <FilmIcon className="w-8 h-8 text-pink-500" />
                    </div>
                  </div>
                  <Text weight="plus" className="mb-1">Generating Video</Text>
                  <Text size="small" className="text-ui-fg-subtle">{generationProgress || "Please wait..."}</Text>
                </div>
              ) : (
                <div className="py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                  <Text weight="plus" className="mb-1">
                    {canGenerateVideo ? "Ready to Generate Video" : "Generate Both Frames First"}
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle mb-4">
                    {canGenerateVideo 
                      ? "Create a smooth transition video from first to last frame"
                      : "You need both an opening and closing shot to generate the video"
                    }
                  </Text>
                  <Button
                    variant="primary"
                    onClick={handleGenerateVideo}
                    disabled={!canGenerateVideo}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Generate Video
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-ui-tag-red-bg border border-ui-tag-red-border flex items-start gap-3">
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
        </Drawer.Body>

        <Drawer.Footer>
          <div className="flex items-center justify-between w-full">
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
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
}

