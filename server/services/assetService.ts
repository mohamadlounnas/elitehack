/**
 * Asset Service
 * Handles asset CRUD operations for production line assets (machines, equipment, etc.)
 * Replaces machineService - assets include machines and all production line equipment
 */

import { supabaseAdmin } from '../config/supabase.js';
import { Asset, AssetStatus, AssetInput } from '../types/index.js';

/**
 * Create asset entry
 */
export async function createAsset(projectId: string, assetData: AssetInput): Promise<Asset> {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .insert({
      project_id: projectId,
      name: assetData.name,
      description: assetData.description || null,
      appearance: assetData.appearance || null,
      manufacturer: assetData.manufacturer || null,
      country: assetData.country || null,
      estimated_price: assetData.estimated_price || null,
      shipping_estimated_price: assetData.shipping_estimated_price || null,
      dimensions: assetData.dimensions || null,
      weight: assetData.weight || null,
      weight_unit: assetData.weight_unit || null,
      supplier_name: assetData.supplier_name || null,
      supplier_contact: assetData.supplier_contact || null,
      supplier_url: assetData.supplier_url || null,
      supplier_info: assetData.supplier_info || null,
      status: 'researching' as AssetStatus,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Asset;
}

/**
 * Create multiple assets
 */
export async function createAssets(projectId: string, assetsArray: AssetInput[]): Promise<Asset[]> {
  const assets = assetsArray.map(asset => ({
    project_id: projectId,
    name: asset.name,
    description: asset.description || null,
    appearance: asset.appearance || null,
    manufacturer: asset.manufacturer || null,
    country: asset.country || null,
    estimated_price: asset.estimated_price || null,
    shipping_estimated_price: asset.shipping_estimated_price || null,
    dimensions: asset.dimensions || null,
    weight: asset.weight || null,
    weight_unit: asset.weight_unit || null,
    supplier_name: asset.supplier_name || null,
    supplier_contact: asset.supplier_contact || null,
    supplier_url: asset.supplier_url || null,
    supplier_info: asset.supplier_info || null,
    status: 'researching' as AssetStatus,
  }));

  const { data, error } = await supabaseAdmin
    .from('assets')
    .insert(assets)
    .select();

  if (error) throw error;
  return (data || []) as Asset[];
}

/**
 * Get assets for a project
 */
export async function getProjectAssets(projectId: string): Promise<Asset[]> {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as Asset[];
}

/**
 * Update asset status
 */
export async function updateAssetStatus(
  assetId: string,
  status: AssetStatus,
  errorMessage: string | null = null
): Promise<Asset> {
  const { data, error } = await supabaseAdmin
    .from('assets')
    .update({
      status,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assetId)
    .select()
    .single();

  if (error) throw error;
  return data as Asset;
}

/**
 * Mark asset as completed
 */
export async function completeAsset(assetId: string): Promise<Asset> {
  const asset = await updateAssetStatus(assetId, 'completed');
  
  // Check if all assets are completed and auto-progress workflow
  const { getProject } = await import('./projectService.js');
  const project = await getProject(asset.project_id);
  
  if (project.status === 'ASSETS_RESEARCH') {
    const allCompleted = await checkAllAssetsCompleted(asset.project_id);
    if (allCompleted) {
      console.log(`[ASSET] All assets completed, triggering auto-progress`);
      const { autoProgressWorkflow } = await import('./workflowAutoProgress.js');
      await autoProgressWorkflow(asset.project_id);
    }
  }
  
  return asset;
}

/**
 * Check if all assets for a project are completed
 */
export async function checkAllAssetsCompleted(projectId: string): Promise<boolean> {
  const assets = await getProjectAssets(projectId);
  if (assets.length === 0) return false;
  return assets.every(asset => asset.status === 'completed');
}

