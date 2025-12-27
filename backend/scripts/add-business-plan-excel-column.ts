import { supabase } from "../src/utils/supabase.js";
import { logger } from "../src/utils/logger.js";

/**
 * Adds business_plan_excel column to projects table
 */
async function addBusinessPlanExcelColumn() {
  try {
    logger.info("Attempting to add 'business_plan_excel' column to 'projects' table...");
    
    // Try to add the column using RPC (if available) or direct SQL
    const { error } = await supabase.rpc('execute_sql', {
      sql_query: `
        ALTER TABLE projects 
        ADD COLUMN IF NOT EXISTS business_plan_excel TEXT;
        COMMENT ON COLUMN projects.business_plan_excel IS 'Path to the generated business plan Excel file';
      `
    }).catch(async () => {
      // If RPC doesn't exist, try direct query (this might not work in Supabase)
      // In that case, user should run the SQL manually
      logger.warn("RPC execute_sql not available. Please run the SQL manually in Supabase SQL editor.");
      return { error: { message: "RPC not available" } };
    });

    if (error) {
      if (error.message?.includes('column "business_plan_excel" already exists')) {
        logger.warn("Column 'business_plan_excel' already exists in 'projects' table. Skipping.");
      } else {
        logger.error("Error adding business_plan_excel column:", error);
        console.log("\n⚠️  Please run this SQL manually in Supabase SQL Editor:\n");
        console.log(`
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS business_plan_excel TEXT;

COMMENT ON COLUMN projects.business_plan_excel IS 'Path to the generated business plan Excel file';
        `);
        throw new Error(`Failed to add business_plan_excel column: ${error.message}`);
      }
    } else {
      logger.info("Successfully added 'business_plan_excel' column to 'projects' table.");
    }
  } catch (err) {
    logger.error("Unhandled error in addBusinessPlanExcelColumn:", err);
    console.log("\n⚠️  Please run this SQL manually in Supabase SQL Editor:\n");
    console.log(`
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS business_plan_excel TEXT;

COMMENT ON COLUMN projects.business_plan_excel IS 'Path to the generated business plan Excel file';
    `);
  } finally {
    process.exit(0);
  }
}

addBusinessPlanExcelColumn();


