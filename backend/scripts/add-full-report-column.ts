/**
 * Migration script to add full_report_pdf_url column to projects table
 * Run with: npx tsx scripts/add-full-report-column.ts
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log("Running migration: add-full-report-column");

    // Read the SQL file
    const sqlPath = path.join(import.meta.dirname, "add-full-report-column.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");

    // Execute the SQL
    const { error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      // Try alternative approach - direct update
      console.log("Trying direct column addition...");
      
      // Check if column exists by querying
      const { data, error: checkError } = await supabase
        .from("projects")
        .select("full_report_pdf_url")
        .limit(1);

      if (checkError && checkError.message.includes("does not exist")) {
        console.error("Column does not exist and cannot be added via RPC");
        console.log("Please run the SQL manually in Supabase dashboard:");
        console.log(sql);
        process.exit(1);
      } else {
        console.log("Column already exists or was added successfully");
      }
    } else {
      console.log("Migration completed successfully");
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigration();

