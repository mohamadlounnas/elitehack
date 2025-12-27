/**
 * Zod Schemas for Asset Data
 * 
 * These schemas define the structure for asset data extraction using LangChain's
 * structured output feature. Assets include machines, equipment, and all production line assets.
 */

import * as z from 'zod';

/**
 * Dimensions schema for asset physical specifications
 */
export const DimensionsSchema = z.object({
  length: z.number().optional().describe('Length in the specified unit'),
  width: z.number().optional().describe('Width in the specified unit'),
  height: z.number().optional().describe('Height in the specified unit'),
  unit: z.string().optional().describe('Unit of measurement (e.g., "cm", "m", "inches")'),
}).optional();

/**
 * Supplier information schema
 */
export const SupplierInfoSchema = z.object({
  location: z.string().optional().describe('Supplier location (city, country)'),
  additional_info: z.string().optional().describe('Additional supplier details, certifications, delivery terms, etc.'),
}).optional();

/**
 * Individual asset schema
 * Represents a single asset (machine, equipment, etc.) with all its details
 */
export const AssetSchema = z.object({
  name: z.string().describe('Asset name including model number if available'),
  description: z.string().describe('Detailed description of the asset and its purpose (verified information)'),
  appearance: z.string().describe('Detailed visual description for image/3D model generation. Describe size, shape, color, key features, distinctive characteristics'),
  manufacturer: z.string().optional().describe('Manufacturer company name (VERIFIED - checked it exists)'),
  country: z.string().optional().describe('Country of manufacture or origin'),
  estimated_price: z.number().optional().describe('Estimated price in base currency'),
  shipping_estimated_price: z.number().optional().describe('Estimated shipping cost in base currency'),
  dimensions: DimensionsSchema.describe('Physical dimensions (length, width, height)'),
  weight: z.number().optional().describe('Weight of the asset'),
  weight_unit: z.string().optional().describe('Weight unit (e.g., "kg", "lbs", "tons")'),
  supplier_name: z.string().optional().describe('Supplier Company Name (VERIFIED - checked website exists)'),
  supplier_contact: z.string().optional().describe('Contact information including email and/or phone (VERIFIED - checked email/phone is valid)'),
  supplier_url: z.string().url().optional().describe('Website URL (VERIFIED - checked URL is accessible)'),
  supplier_info: SupplierInfoSchema.describe('Additional supplier information'),
});

/**
 * Assets list schema
 * Contains an array of assets - for each asset type, there should be 3 alternatives
 */
export const AssetsListSchema = z.object({
  assets: z.array(AssetSchema).min(1).describe('Array of assets. For each asset type needed, provide exactly 3 alternatives from different suppliers/manufacturers'),
});

