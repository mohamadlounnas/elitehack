/**
 * Migration script to add first_frame_url column to video_projects table
 * Run with: npx tsx scripts/add-first-frame-column.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from backend directory
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrate() {
  console.log("Adding first_frame_url column to video_projects table...");

  const { error } = await supabase.rpc("exec_sql", {
    sql: `
      ALTER TABLE video_projects 
      ADD COLUMN IF NOT EXISTS first_frame_url TEXT;
      
      COMMENT ON COLUMN video_projects.first_frame_url IS 'URL to the first frame image for Veo 3.1 FIRST_AND_LAST_FRAMES_2_VIDEO generation';
    `,
  });

  if (error) {
    // Try direct SQL if rpc doesn't work
    console.log("Trying direct approach...");
    
    // Check if column exists
    const { data: columns, error: checkError } = await supabase
      .from("video_projects")
      .select("first_frame_url")
      .limit(0);
    
    if (checkError && checkError.message.includes("column")) {
      console.error("Column doesn't exist. Please run this SQL manually:");
      console.log(`
        ALTER TABLE video_projects 
        ADD COLUMN IF NOT EXISTS first_frame_url TEXT;
      `);
      process.exit(1);
    } else {
      console.log("Column already exists or was added successfully!");
    }
  } else {
    console.log("Migration completed successfully!");
  }
}

migrate().catch(console.error);

