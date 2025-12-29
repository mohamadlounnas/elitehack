import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
}

/**
 * Retry wrapper for Supabase operations
 */
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors
      if (error.message?.includes("does not exist") || 
          error.message?.includes("not found") ||
          error.message?.includes("permission denied")) {
        throw error;
      }
      
      // If not the last attempt, wait and retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        continue;
      }
    }
  }
  
  throw lastError || new Error("Operation failed after retries");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
  global: {
    fetch: async (url, options = {}) => {
      // Increase timeout to 60 seconds for slow queries
      const timeout = 60000; // 60 seconds
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        return response;
      } catch (error: any) {
        if (error.name === "AbortError" || error.message?.includes("timeout") || error.message?.includes("aborted")) {
          throw new Error(`Supabase request timeout after ${timeout/1000}s: ${url}`);
        }
        if (error.message?.includes("ENOTFOUND") || error.message?.includes("getaddrinfo")) {
          throw new Error(`Supabase connection error: Unable to reach ${supabaseUrl}. Please check your network connection and Supabase project status.`);
        }
        throw error;
      }
    },
  },
});

/**
 * Helper function to execute Supabase queries with retry logic
 * The queryFn should return a Supabase query builder, which will be executed
 */
export async function supabaseQueryWithRetry<T>(
  queryFn: () => any, // Returns a Supabase query builder
  maxRetries: number = 2
): Promise<{ data: T | null; error: any }> {
  return retryOperation(async () => {
    const query = queryFn();
    // Execute the query (Supabase queries are executed when awaited)
    return await query;
  }, maxRetries, 2000);
}

/**
 * Create a Supabase client with custom timeout (for background services like polling)
 */
export function createSupabaseClientWithTimeout(timeoutMs: number = 15000) {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "public",
    },
    global: {
      fetch: async (url, options = {}) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          return response;
        } catch (error: any) {
          if (error.name === "AbortError" || error.message?.includes("timeout") || error.message?.includes("aborted")) {
            throw new Error(`Supabase request timeout after ${timeoutMs/1000}s: ${url}`);
          }
          if (error.message?.includes("ENOTFOUND") || error.message?.includes("getaddrinfo")) {
            throw new Error(`Supabase connection error: Unable to reach ${supabaseUrl}. Please check your network connection and Supabase project status.`);
          }
          throw error;
        }
      },
    },
  });
}

