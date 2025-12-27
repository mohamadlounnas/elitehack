/**
 * Project service
 * Handles project CRUD operations and status transitions
 */

import { supabaseAdmin } from '../config/supabase.js';
import { Project, ProjectStatus } from '../types/index.js';

/**
 * Create a new project
 */
export async function createProject(name: string, description: string = ''): Promise<Project> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      name,
      description,
      status: 'DATA_COLLECTING' as ProjectStatus,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

/**
 * Get project by ID
 */
export async function getProject(projectId: string): Promise<Project> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data as Project;
}

/**
 * Get all projects
 */
export async function getAllProjects(): Promise<Project[]> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Project[];
}

/**
 * Update project status
 */
export async function updateProjectStatus(
  projectId: string, 
  status: ProjectStatus, 
  resultData: Record<string, unknown> | null = null
): Promise<Project> {
  const updateData: Record<string, unknown> = { 
    status, 
    updated_at: new Date().toISOString() 
  };

  if (status === 'CREATING_PROCCES' && resultData) {
    updateData.creating_procces_result = resultData;
  } else if (status === 'DATA_COLLECTING' && resultData) {
    updateData.data_collecting_result = resultData;
  }

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(updateData)
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

/**
 * Save data collecting result
 */
export async function saveDataCollectingResult(
  projectId: string, 
  result: Record<string, unknown>
): Promise<Project> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .update({
      data_collecting_result: result,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

/**
 * Check if all machines for a project are completed
 */
export async function checkAllMachinesCompleted(projectId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .select('status')
    .eq('project_id', projectId);

  if (error) throw error;

  if (!data || data.length === 0) return false;

  const allCompleted = data.every((machine: { status: string }) => machine.status === 'completed');
  
  if (allCompleted) {
    // Update project status to MACHINES_GENERATED
    await updateProjectStatus(projectId, 'MACHINES_GENERATED');
  }

  return allCompleted;
}

