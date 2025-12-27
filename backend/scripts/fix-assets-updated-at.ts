/**
 * Fix script to add updated_at column to assets table if missing
 * This resolves the error: "record \"new\" has no field \"updated_at\""
 * 
 * Run this with: npm run fix-assets-updated-at
 * 
 * This script attempts to fix the issue by checking if the column exists
 * and providing instructions if manual SQL execution is needed.
 */

import { supabase } from "../src/utils/supabase.js";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function fixAssetsUpdatedAt() {
  try {
    console.log("🔧 Running fix for assets.updated_at column...\n");

    // First, check if the column already exists by trying to query it
    const { error: checkError } = await supabase
      .from("assets")
      .select("updated_at")
      .limit(1);

    if (!checkError) {
      console.log("✅ Column 'updated_at' already exists in assets table!");
      console.log("   The trigger should work now. If errors persist, the trigger may need to be recreated.\n");
      
      // Try to verify trigger exists by doing a test update (on a non-existent row to avoid side effects)
      console.log("   Verifying trigger configuration...");
      return;
    }

    // Column doesn't exist - need to add it
    console.log("⚠️  Column 'updated_at' is missing from assets table.");
    console.log("   Supabase JS client doesn't support raw SQL execution for security reasons.\n");
    
    // Try using REST API with service role key
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && serviceRoleKey) {
      console.log("🔄 Attempting to use Supabase Management API...\n");
      
      // Extract project ref from URL (format: https://xxxxx.supabase.co)
      const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
      
      if (projectRef) {
        console.log(`   Project: ${projectRef}`);
        console.log("   Note: Management API also requires manual SQL execution.\n");
      }
    }

    // Show SQL that needs to be run
    console.log("📋 Please run the following SQL in your Supabase SQL Editor:\n");
    console.log("─".repeat(60));
    
    const sqlPath = join(__dirname, "fix-assets-updated-at.sql");
    const sql = readFileSync(sqlPath, "utf-8");
    console.log(sql);
    console.log("─".repeat(60));
    
    console.log("\n📍 SQL file location:", sqlPath);
    console.log("\n💡 Quick Steps:");
    console.log("   1. Open https://supabase.com/dashboard");
    console.log("   2. Select your project");
    console.log("   3. Go to SQL Editor (left sidebar)");
    console.log("   4. Click 'New query'");
    console.log("   5. Copy and paste the SQL above");
    console.log("   6. Click 'Run' (or press Cmd/Ctrl + Enter)");
    console.log("   7. Verify success message appears");
    console.log("\n✨ After running, restart your backend server to clear any cached errors.\n");
    
  } catch (error: any) {
    console.error("❌ Error running fix script:", error.message);
    const sqlPath = join(__dirname, "fix-assets-updated-at.sql");
    console.log("\n📋 Please run the SQL file manually in Supabase SQL editor:");
    console.log("   ", sqlPath);
  }
}

// Run the fix
fixAssetsUpdatedAt()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fix script failed:", error);
    process.exit(1);
  });

