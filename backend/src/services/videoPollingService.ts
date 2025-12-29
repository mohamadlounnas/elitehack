/**
 * Background service to poll Kie.ai video generation tasks
 * Runs independently of SSE connections to ensure videos are processed even if client disconnects
 */

import { supabase, createSupabaseClientWithTimeout } from "../utils/supabase.js";
import { logger } from "../utils/logger.js";
import axios from "axios";

const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds
const MAX_POLL_AGE_MS = 30 * 60 * 1000; // Stop polling after 30 minutes
const POLL_QUERY_TIMEOUT_MS = 10000; // 10 second timeout for polling queries

interface VideoProject {
  id: string;
  project_id: string;
  status: string;
  metadata?: {
    kie_task_id?: string;
    kie_task_created_at?: string;
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
        const { data: pendingVideos, error } = await pollingClient
          .from("video_projects")
          .select("id, project_id, status, video_url, metadata")
          .eq("status", "video_generating")
          .not("metadata->>kie_task_id", "is", null)
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
      const taskId = video.metadata?.kie_task_id;
      if (!taskId) {
        logger.warn("Video has no task ID, skipping", { videoId: video.id });
        return;
      }

      // Check if task is too old (give up after 30 minutes)
      const taskCreatedAt = video.metadata?.kie_task_created_at;
      if (taskCreatedAt) {
        const age = Date.now() - new Date(taskCreatedAt).getTime();
        if (age > MAX_POLL_AGE_MS) {
          logger.warn("Video task too old, marking as failed", {
            videoId: video.id,
            age: Math.round(age / 1000 / 60) + " minutes",
          });
          await supabase
            .from("video_projects")
            .update({
              status: "frames_ready",
              metadata: {
                ...video.metadata,
                kie_task_error: "Task timeout after 30 minutes",
              },
            })
            .eq("id", video.id);
          return;
        }
      }

      // Query task status from Kie.ai
      const statusResponse = await axios.get(
        `https://api.kie.ai/api/v1/jobs/recordInfo?taskId=${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${kieApiKey}`,
          },
        }
      );

      if (statusResponse.data.code !== 200) {
        logger.error("Failed to check task status", {
          videoId: video.id,
          taskId,
          error: statusResponse.data.msg,
        });
        return;
      }

      const taskData = statusResponse.data.data;
      const state = taskData.state;

      if (state === "waiting") {
        // Still processing, do nothing
        logger.debug("Video still processing", { videoId: video.id, taskId });
        return;
      } else if (state === "success") {
        // Video generation complete!
        try {
          const resultJson = JSON.parse(taskData.resultJson);
          const videoUrl = resultJson.resultUrls?.[0];

          if (!videoUrl) {
            throw new Error("No video URL in result");
          }

          // Update video project
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

          logger.info("Video generation completed", {
            videoId: video.id,
            taskId,
            videoUrl,
          });
        } catch (parseError: any) {
          logger.error("Failed to parse video result", {
            videoId: video.id,
            taskId,
            error: parseError.message,
          });

          // Mark as failed
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
        logger.error("Video generation failed", {
          videoId: video.id,
          taskId,
          error: errorMsg,
          failCode: taskData.failCode,
        });

        // Reset status so user can retry
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

