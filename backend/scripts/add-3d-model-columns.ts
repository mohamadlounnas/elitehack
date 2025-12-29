/**
 * Script to add meshy_id and model_url columns to assets table
 * Run this with: tsx scripts/add-3d-model-columns.ts
 */

import { supabase } from "../src/utils/supabase.js";

async function add3DModelColumns() {
  try {
    console.log("Adding meshy_id and model_url columns to assets table...");

    // Execute the SQL to add the columns
    const { error } = await supabase.rpc("exec_sql", {
      sql: `
        ALTER TABLE assets 
        ADD COLUMN IF NOT EXISTS meshy_id TEXT;
        
        ALTER TABLE assets 
        ADD COLUMN IF NOT EXISTS model_url TEXT;
      `,
    });

    if (error) {
      // If RPC doesn't work, try direct query (may require service role key)
      console.log("RPC method failed, trying alternative approach...");
      console.log("Please run this SQL in your Supabase SQL Editor:");
      console.log(`
        ALTER TABLE assets 
        ADD COLUMN IF NOT EXISTS meshy_id TEXT;
        
        ALTER TABLE assets 
        ADD COLUMN IF NOT EXISTS model_url TEXT;
      `);
      console.log("\nOr use the SQL file: backend/scripts/add-3d-model-columns.sql");
      return;
    }

    console.log("✓ 3D model columns added successfully!");
  } catch (error: any) {
    console.error("Error adding 3D model columns:", error);
    console.log("\nPlease run this SQL in your Supabase SQL Editor:");
    console.log(`
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS meshy_id TEXT;
      
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS model_url TEXT;
    `);
    console.log("\nOr use the SQL file: backend/scripts/add-3d-model-columns.sql");
  }
}

add3DModelColumns();

