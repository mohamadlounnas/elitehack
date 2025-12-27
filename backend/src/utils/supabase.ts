import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
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
    fetch: (url, options = {}) => {
      return fetch(url, {
        ...options,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      }).catch((error) => {
        if (error.name === "AbortError" || error.message?.includes("timeout")) {
          throw new Error(`Supabase request timeout: ${url}`);
        }
        if (error.message?.includes("ENOTFOUND") || error.message?.includes("getaddrinfo")) {
          throw new Error(`Supabase connection error: Unable to reach ${supabaseUrl}. Please check your network connection and Supabase project status.`);
        }
        throw error;
      });
    },
  },
});

