/**
 * Script to run database migrations
 * 
 * This script reads the migrate.sql file and executes it using Supabase's
 * execute_sql functionality. Since Supabase's JavaScript client doesn't support
 * DDL execution directly, this script will attempt to use the Management API
 * or provide instructions for manual execution.
 * 
 * Usage: npx tsx scripts/migrate.ts
 */

import { supabase } from "../src/utils/supabase.js";
import dotenv from "dotenv";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Executes SQL using Supabase's execute_sql MCP tool or direct API call
 */
async function executeSQL(sql: string): Promise<{ success: boolean; error?: string }> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables");
  }

  // Extract project reference from Supabase URL
  // URL format: https://<project-ref>.supabase.co
  const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!urlMatch) {
    throw new Error("Invalid SUPABASE_URL format. Expected: https://<project-ref>.supabase.co");
  }

  const projectRef = urlMatch[1];

  try {
    // Use Supabase's REST API to execute SQL via the query endpoint
    // Note: This requires the project to have SQL execution enabled
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ sql }),
    });

    // If the RPC endpoint doesn't exist, we'll need to use a different approach
    if (response.status === 404) {
      return {
        success: false,
        error: "SQL execution RPC function not found. Please create it or use manual execution.",
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}

async function runMigration() {
  try {
    console.log("🔄 Starting database migration...\n");

    // Read the SQL migration file
    const sqlPath = join(__dirname, "migrate.sql");
    const sql = readFileSync(sqlPath, "utf-8");

    console.log("Executing migration SQL...\n");

    // Try to execute the SQL
    const result = await executeSQL(sql);

    if (result.success) {
      console.log("✅ Migration completed successfully!\n");
    } else {
      console.error(`❌ Migration failed: ${result.error}\n`);
      console.log("⚠️  The Supabase JavaScript client doesn't support DDL execution.\n");
      console.log("Please run the migration manually using one of these methods:\n");
      console.log("Option 1: Use Supabase Dashboard");
      console.log("  1. Go to your Supabase dashboard");
      console.log("  2. Navigate to SQL Editor");
      console.log("  3. Copy and paste the contents of scripts/migrate.sql");
      console.log("  4. Execute the SQL\n");
      console.log("Option 2: Use Supabase CLI");
      console.log("  supabase db reset\n");
      console.log("Option 3: Use Supabase MCP tools (if configured)");
      console.log("  The migrate.sql file is ready at: scripts/migrate.sql\n");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Fatal error running migration:", error);
    console.log("\n⚠️  Please run the migrate.sql file manually in your Supabase SQL Editor.\n");
    process.exit(1);
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });

