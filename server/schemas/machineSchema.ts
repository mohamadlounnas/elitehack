/**
 * Zod Schemas for Machine Data
 * 
 * These schemas define the structure for machine data extraction using LangChain's
 * structured output feature. This ensures type-safe, validated data extraction.
 */

import * as z from 'zod';

/**
 * Supplier information schema
 */
export const SupplierInfoSchema = z.object({
  location: z.string().describe('Supplier location (city, country)'),
  additional_info: z.string().optional().describe('Pricing, delivery time, and other relevant verified information'),
});

/**
 * Individual machine schema
 * Represents a single machine with all its details
 */
export const MachineSchema = z.object({
  name: z.string().describe('Machine name including model number and supplier name (e.g., "Machine Type - Option 1 / Supplier Name")'),
  description: z.string().describe('Detailed description of the machine and its purpose (verified information)'),
  appearance: z.string().describe('Detailed visual description so an AI can generate an accurate image. Describe size, shape, color, key features, distinctive characteristics'),
  supplier_name: z.string().describe('Supplier Company Name (VERIFIED - checked website exists)'),
  supplier_contact: z.string().describe('Contact information including email and/or phone (VERIFIED - checked email/phone is valid)'),
  supplier_url: z.string().url().describe('Website URL (VERIFIED - checked URL is accessible)'),
  supplier_info: SupplierInfoSchema.describe('Additional supplier information'),
});

/**
 * Machines list schema
 * Contains an array of machines - for each machine type, there should be 3 alternatives
 */
export const MachinesListSchema = z.object({
  machines: z.array(MachineSchema).min(1).describe('Array of machines. For each machine type needed, provide exactly 3 alternatives from different suppliers'),
});

