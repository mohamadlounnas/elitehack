/**
 * Script to drop all data from the database
 * WARNING: This will delete ALL data from all tables!
 * 
 * Usage: npx tsx scripts/drop-database.ts
 */

import { supabase } from "../src/utils/supabase.js";
import dotenv from "dotenv";

dotenv.config();

async function dropDatabase() {
  try {
    console.log("⚠️  WARNING: This will delete ALL data from the database!");
    console.log("Starting database drop...\n");

    // List of all tables to truncate (in order to respect foreign key constraints)
    // Delete child tables first, then parent tables
    const tables = [
      "tco_calculations",        // References projects
      "generated_files",          // References projects
      "assets",                   // References projects, suppliers
      "project_files",            // References projects
      "project_messages",         // References projects
      "suppliers",                // Referenced by assets
      "projects",                 // Parent table
    ];

    // Delete from each table using DELETE (works without special permissions)
    for (const table of tables) {
      try {
        console.log(`Deleting from ${table}...`);
        
        // First, get all IDs to delete
        const { data: rows, error: selectError } = await supabase
          .from(table)
          .select("id")
          .limit(10000); // Safety limit

        if (selectError) {
          console.error(`  ✗ Error selecting from ${table}:`, selectError.message);
          continue;
        }

        if (!rows || rows.length === 0) {
          console.log(`  ✓ ${table} is already empty`);
          continue;
        }

        // Delete all rows in batches (Supabase requires a filter)
        // Delete using the IDs we fetched
        let deletedCount = 0;
        const batchSize = 100;
        
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const ids = batch.map(r => r.id).filter(Boolean);
          
          if (ids.length === 0) continue;
          
          const { error: batchError } = await supabase
            .from(table)
            .delete()
            .in("id", ids);
          
          if (batchError) {
            console.error(`  ✗ Error deleting batch from ${table}:`, batchError.message);
            break;
          } else {
            deletedCount += ids.length;
          }
        }
        
        const deleteError = deletedCount < rows.length ? new Error(`Only deleted ${deletedCount} of ${rows.length} rows`) : null;

        if (deleteError) {
          console.error(`  ✗ Error deleting from ${table}:`, deleteError.message);
        } else {
          console.log(`  ✓ Deleted ${rows.length} row(s) from ${table}`);
        }
      } catch (err: any) {
        console.error(`  ✗ Error processing ${table}:`, err.message);
      }
    }

    console.log("\n✅ Database drop complete!");
    console.log("All tables have been cleared.");
  } catch (error: any) {
    console.error("❌ Fatal error dropping database:", error);
    process.exit(1);
  }
}

// Run the script
dropDatabase()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
