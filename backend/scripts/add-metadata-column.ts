/**
 * Script to add metadata column to projects table
 * Run this with: tsx scripts/add-metadata-column.ts
 */

import { supabase } from "../src/utils/supabase.js";

async function addMetadataColumn() {
  try {
    console.log("Adding metadata column to projects table...");

    // Execute the SQL to add the metadata column
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        ALTER TABLE projects 
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      `,
    });

    if (error) {
      // If RPC doesn't work, try direct query (may require service role key)
      console.log("RPC method failed, trying alternative approach...");
      console.log("Please run this SQL in your Supabase SQL Editor:");
      console.log(`
        ALTER TABLE projects 
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
      `);
      console.log("\nOr use the SQL file: backend/scripts/add-metadata-column.sql");
      return;
    }

    console.log("✓ Metadata column added successfully!");
  } catch (error: any) {
    console.error("Error adding metadata column:", error);
    console.log("\nPlease run this SQL in your Supabase SQL Editor:");
    console.log(`
      ALTER TABLE projects 
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
    `);
    console.log("\nOr use the SQL file: backend/scripts/add-metadata-column.sql");
  }
}

addMetadataColumn();


