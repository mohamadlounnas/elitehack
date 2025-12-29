/**
 * Background service to poll Kie.ai Veo 3.1 video generation tasks
 * Runs independently of SSE connections to ensure videos are processed even if client disconnects
 */

import { supabase, createSupabaseClientWithTimeout } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";
import axios from "axios";

const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds
const MAX_POLL_AGE_MS = 45 * 60 * 1000; // Stop polling after 45 minutes (Veo can take longer)
const POLL_QUERY_TIMEOUT_MS = 10000; // 10 second timeout for polling queries

interface VideoProject {
  id: string;
  project_id: string;
  status: string;
  metadata?: {
    // Legacy Hailuo task IDs
    kie_task_id?: string;
    kie_task_created_at?: string;
    // Veo 3.1 task IDs
    veo_task_id?: string;
    veo_task_created_at?: string;
    veo_model?: string;
    veo_generation_type?: string;
    // Frame prompts
    first_frame_prompt?: string;
    last_frame_prompt?: string;
  };
  video_url?: string | null;
}

class VideoPollingService {
  private pollInterval: NodeJS.Timeout | null = null;
  private isRunning = false;

  start() {
    if (this.isRunning) {
      logger.warn("Video polling service is already running");
      return;
    }

    this.isRunning = true;
    logger.info("Starting video polling service", { interval: POLL_INTERVAL_MS });

    // Start polling immediately, then at intervals
    this.pollPendingVideos();
    this.pollInterval = setInterval(() => {
      this.pollPendingVideos();
    }, POLL_INTERVAL_MS);
  }

  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isRunning = false;
    logger.info("Video polling service stopped");
  }

  private async pollPendingVideos() {
    try {
      const kieApiKey = process.env.KIE_API_KEY;
      if (!kieApiKey) {
        logger.warn("KIE_API_KEY not configured, skipping video polling");
        return;
      }

      // Use a separate Supabase client with shorter timeout for polling
      // This prevents the polling service from blocking on slow queries
      const pollingClient = createSupabaseClientWithTimeout(POLL_QUERY_TIMEOUT_MS);

      // Find all videos that are currently generating
      // Use a two-step approach: fast count check, then detailed query
      try {
        // Step 1: Quick count check (should be fast with index on status)
        // Use a timeout wrapper to prevent blocking
        let count: number | null = null;
        try {
          const countQuery = pollingClient
            .from("video_projects")
            .select("id", { count: "exact", head: true })
            .eq("status", "video_generating")
            .limit(1);
          
          const countResult = await Promise.race([
            countQuery,
            new Promise<{ count: null; error: { message: string } }>((resolve) =>
              setTimeout(() => resolve({ count: null, error: { message: "Count query timeout" } }), 5000)
            ),
          ]) as { count?: number | null; error?: any };

          if (countResult.error) {
            logger.warn("Count query error in video polling (will retry on next interval)", {
              error: countResult.error.message || countResult.error,
            });
            return;
          }

          count = countResult.count ?? null;
        } catch (countError: any) {
          if (countError.message?.includes("timeout")) {
            logger.warn("Count query timeout in video polling (will retry on next interval)");
          } else {
            logger.warn("Count query failed in video polling (will retry on next interval)", {
              error: countError.message || countError,
            });
          }
          return;
        }

        if (!count || count === 0) {
          return; // No pending videos, skip expensive query
        }

        // Step 2: Fetch actual videos (with timeout protection from client)
        // Support both legacy Hailuo (kie_task_id) and new Veo 3.1 (veo_task_id)
        const { data: pendingVideos, error } = await pollingClient
          .from("video_projects")
          .select("id, project_id, status, video_url, metadata")
          .eq("status", "video_generating")
          .limit(50); // Limit to prevent huge queries

        if (error) {
          // Don't log as error if it's a timeout - just warn and continue
          if (error.message?.includes("timeout")) {
            logger.warn("Query timeout in video polling service (will retry on next interval)", {
              error: error.message,
            });
          } else {
            logger.error("Error fetching pending videos", { error: error.message || error });
          }
          return;
        }

        if (!pendingVideos || pendingVideos.length === 0) {
          return; // No pending videos
        }

        logger.info(`Polling ${pendingVideos.length} pending video(s)`);

        for (const video of pendingVideos as VideoProject[]) {
          await this.checkVideoStatus(video, kieApiKey);
        }
      } catch (timeoutError: any) {
        // Handle timeout gracefully - don't crash the service
        if (timeoutError.message?.includes("timeout")) {
          logger.warn("Query timeout in video polling service (will retry on next interval)", {
            error: timeoutError.message,
          });
        } else {
          logger.error("Error fetching pending videos", { error: timeoutError.message || timeoutError });
        }
      }
    } catch (error: any) {
      // Catch-all to prevent service from crashing
      logger.error("Error in video polling service", { error: error.message || error });
    }
  }

  private async checkVideoStatus(video: VideoProject, kieApiKey: string) {
    try {
      // Support both Veo 3.1 (veo_task_id) and legacy Hailuo (kie_task_id)
      const taskId = video.metadata?.veo_task_id || video.metadata?.kie_task_id;
      const isVeoTask = !!video.metadata?.veo_task_id;
      
      if (!taskId) {
        logger.warn("Video has no task ID, skipping", { videoId: video.id });
        return;
      }

      // Check if task is too old (give up after configured timeout)
      const taskCreatedAt = video.metadata?.veo_task_created_at || video.metadata?.kie_task_created_at;
      if (taskCreatedAt) {
        const age = Date.now() - new Date(taskCreatedAt).getTime();
        if (age > MAX_POLL_AGE_MS) {
          logger.warn("Video task too old, marking as failed", {
            videoId: video.id,
            age: Math.round(age / 1000 / 60) + " minutes",
            isVeoTask,
          });
          await supabase
            .from("video_projects")
            .update({
              status: "frames_ready",
              metadata: {
                ...video.metadata,
                [isVeoTask ? "veo_task_error" : "kie_task_error"]: `Task timeout after ${Math.round(MAX_POLL_AGE_MS / 1000 / 60)} minutes`,
              },
            })
            .eq("id", video.id);
          return;
        }
      }

      // Query task status from Kie.ai - use different endpoints for Veo vs Hailuo
      const statusEndpoint = isVeoTask 
        ? `https://api.kie.ai/api/v1/veo/record-info?taskId=${taskId}`
        : `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`;
        
      const statusResponse = await axios.get(statusEndpoint, {
        headers: {
          Authorization: `Bearer ${kieApiKey}`,
        },
      });

      if (statusResponse.data.code !== 200) {
        // For Veo, code 422 with "record is null" means task is still initializing
        if (isVeoTask && statusResponse.data.code === 422 && statusResponse.data.msg?.includes("record is null")) {
          logger.debug("Veo task still initializing", { videoId: video.id, taskId });
          return; // Will retry on next poll
        }
        logger.error("Failed to check task status", {
          videoId: video.id,
          taskId,
          isVeoTask,
          error: statusResponse.data.msg,
        });
        return;
      }

      const taskData = statusResponse.data.data;
      
      // Handle null taskData - task might still be initializing
      if (!taskData) {
        logger.debug("Task data is null, task might still be initializing", { 
          videoId: video.id, 
          taskId, 
          isVeoTask 
        });
        return; // Will retry on next poll
      }

      // Handle Veo and Hailuo differently due to different response structures
      if (isVeoTask) {
        // Veo uses successFlag: 0 = Generating, 1 = Success, 2 = Failed, 3 = Generation Failed
        const successFlag = taskData.successFlag;

        if (successFlag === 0) {
          // Still generating
          logger.debug("Veo video still generating", { videoId: video.id, taskId });
          return;
        } else if (successFlag === 1) {
          // Success!
          try {
            const response = taskData.response;
            let videoUrl: string | null = null;
            
            if (response?.resultUrls && response.resultUrls.length > 0) {
              videoUrl = response.resultUrls[0];
            }

            if (!videoUrl) {
              throw new Error("No video URL in Veo result");
            }

            await supabase
              .from("video_projects")
              .update({
                video_url: videoUrl,
                status: "completed",
                metadata: {
                  ...video.metadata,
                  veo_task_completed_at: new Date().toISOString(),
                  veo_fallback_used: taskData.fallbackFlag || false,
                },
              })
              .eq("id", video.id);

            logger.info("Veo video generation completed", {
              videoId: video.id,
              taskId,
              videoUrl,
            });
          } catch (parseError: any) {
            logger.error("Failed to parse Veo video result", {
              videoId: video.id,
              taskId,
              error: parseError.message,
            });

            await supabase
              .from("video_projects")
              .update({
                status: "frames_ready",
                metadata: {
                  ...video.metadata,
                  veo_task_error: "Failed to parse video result",
                },
              })
              .eq("id", video.id);
          }
        } else if (successFlag === 2 || successFlag === 3) {
          // Failed
          const errorMsg = taskData.errorMessage || "Veo video generation failed";
          logger.error("Veo video generation failed", {
            videoId: video.id,
            taskId,
            error: errorMsg,
            errorCode: taskData.errorCode,
          });

          await supabase
            .from("video_projects")
            .update({
              status: "frames_ready",
              metadata: {
                ...video.metadata,
                veo_task_error: errorMsg,
                veo_task_error_code: taskData.errorCode,
              },
            })
            .eq("id", video.id);
        }
      } else {
        // Legacy Hailuo handling
        const state = taskData.state;

        if (state === "waiting" || state === "processing") {
          // Still processing, do nothing
          logger.debug("Hailuo video still processing", { videoId: video.id, taskId, state });
          return;
        } else if (state === "success") {
          // Video generation complete!
          try {
            const resultJson = JSON.parse(taskData.resultJson);
            let videoUrl: string | null = null;
            
            if (resultJson.resultUrls) {
              const urls = typeof resultJson.resultUrls === "string" 
                ? JSON.parse(resultJson.resultUrls) 
                : resultJson.resultUrls;
              if (Array.isArray(urls) && urls.length > 0) {
                videoUrl = urls[0];
              } else if (typeof urls === "string") {
                videoUrl = urls;
              }
            }

            if (!videoUrl) {
              throw new Error("No video URL in result");
            }

            await supabase
              .from("video_projects")
              .update({
                video_url: videoUrl,
                status: "completed",
                metadata: {
                  ...video.metadata,
                  kie_task_completed_at: new Date().toISOString(),
                  kie_task_cost_time: taskData.costTime,
                },
              })
              .eq("id", video.id);

            logger.info("Hailuo video generation completed", {
              videoId: video.id,
              taskId,
              videoUrl,
            });
          } catch (parseError: any) {
            logger.error("Failed to parse Hailuo video result", {
              videoId: video.id,
              taskId,
              error: parseError.message,
            });

            await supabase
              .from("video_projects")
              .update({
                status: "frames_ready",
                metadata: {
                  ...video.metadata,
                  kie_task_error: "Failed to parse video result",
                },
              })
              .eq("id", video.id);
          }
        } else if (state === "fail") {
          // Video generation failed
          const errorMsg = taskData.failMsg || "Video generation failed";
          logger.error("Hailuo video generation failed", {
            videoId: video.id,
            taskId,
            error: errorMsg,
            failCode: taskData.failCode,
          });

          await supabase
            .from("video_projects")
            .update({
              status: "frames_ready",
              metadata: {
                ...video.metadata,
                kie_task_error: errorMsg,
                kie_task_fail_code: taskData.failCode,
              },
            })
            .eq("id", video.id);
        }
      }
    } catch (error: any) {
      logger.error("Error checking video status", {
        videoId: video.id,
        error: error.message,
      });
    }
  }
}

// Singleton instance
export const videoPollingService = new VideoPollingService();

