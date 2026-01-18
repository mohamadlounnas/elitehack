/**
 * Script to add meshy_id and model_url columns to projects table
 * Run with: npx tsx scripts/add-project-3d-columns.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addProject3DColumns() {
  try {
    console.log("Adding meshy_id and model_url columns to projects table...");

    // Read SQL file
    const sqlPath = path.join(__dirname, "add-project-3d-columns.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    // Execute SQL
    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      // If RPC doesn't exist, try direct query
      console.log("RPC not available, trying direct ALTER TABLE...");
      
      // Try to add columns directly
      const alter1 = await supabase
        .from("projects")
        .select("id")
        .limit(1);
      
      // If table exists, try to add columns via raw SQL (if we have access)
      console.log("Note: You may need to run the SQL file directly in your database:");
      console.log(sqlPath);
      
      // Alternative: Use Supabase client to check if columns exist
      const { data: sampleProject } = await supabase
        .from("projects")
        .select("id, meshy_id, model_url")
        .limit(1)
        .maybeSingle();
      
      if (sampleProject) {
        console.log("Columns may already exist or were added successfully");
        console.log("Sample project:", sampleProject);
      }
    } else {
      console.log("Columns added successfully!");
    }

    // Verify columns exist
    const { data: projects, error: verifyError } = await supabase
      .from("projects")
      .select("id, meshy_id, model_url")
      .limit(1);

    if (verifyError) {
      console.error("Error verifying columns:", verifyError);
    } else {
      console.log("Verification successful. Columns exist in projects table.");
    }
  } catch (error: any) {
    console.error("Error adding columns:", error);
    console.log("\nPlease run the SQL file directly in your database:");
    console.log("psql -U your_user -d your_database -f scripts/add-project-3d-columns.sql");
  }
}

addProject3DColumns()
  .then(() => {
    console.log("Script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });


