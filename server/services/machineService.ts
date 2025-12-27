/**
 * Machine service
 * Handles machine CRUD operations and generation workflow
 */

import { supabaseAdmin } from '../config/supabase.js';
import { generateImage } from '../config/langchain.js';
import { generate3DModel } from './meshy3d.js';
import { checkAllMachinesCompleted } from './projectService.js';
import { Machine, MachineStatus, MachineInput } from '../types/index.js';

/**
 * Create machine entry
 */
export async function createMachine(projectId: string, machineData: MachineInput): Promise<Machine> {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .insert({
      project_id: projectId,
      name: machineData.name,
      appearance: machineData.appearance || machineData.description || null,
      description: machineData.description || null,
      supplier_name: machineData.supplier_name || null,
      supplier_contact: machineData.supplier_contact || 'Fixed phone number',
      supplier_url: machineData.supplier_url || null,
      supplier_info: machineData.supplier_info || null,
      status: 'pending' as MachineStatus,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Machine;
}

/**
 * Create multiple machines
 */
export async function createMachines(projectId: string, machinesArray: MachineInput[]): Promise<Machine[]> {
  const machines = machinesArray.map(machine => ({
    project_id: projectId,
    name: machine.name,
    appearance: machine.appearance || machine.description || null,
    description: machine.description || machine.name,
    supplier_name: machine.supplier_name || null,
    supplier_contact: machine.supplier_contact || 'Fixed phone number',
    supplier_url: machine.supplier_url || null,
    supplier_info: machine.supplier_info || null,
    status: 'pending' as MachineStatus,
  }));

  const { data, error } = await supabaseAdmin
    .from('machines')
    .insert(machines)
    .select();

  if (error) throw error;
  return (data || []) as Machine[];
}

/**
 * Get machines for a project
 */
export async function getProjectMachines(projectId: string): Promise<Machine[]> {
  const { data, error } = await supabaseAdmin
    .from('machines')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []) as Machine[];
}

/**
 * Update machine status
 */
export async function updateMachineStatus(
  machineId: string, 
  status: MachineStatus, 
  updates: Partial<Machine> = {}
): Promise<Machine> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...updates,
  };

  const { data, error } = await supabaseAdmin
    .from('machines')
    .update(updateData)
    .eq('id', machineId)
    .select()
    .single();

  if (error) throw error;
  return data as Machine;
}

/**
 * Process machine generation workflow
 * Handles: image generation → 3D model generation
 */
export async function processMachineGeneration(machineId: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    // Get machine data
    const { data: machine, error: fetchError } = await supabaseAdmin
      .from('machines')
      .select('*')
      .eq('id', machineId)
      .single();

    if (fetchError) throw fetchError;
    if (!machine) throw new Error('Machine not found');

    console.log(`\n[MACHINE] ========== Machine Generation Started ==========`);
    console.log(`[MACHINE] Machine ID: ${machineId}`);
    console.log(`[MACHINE] Machine Name: ${machine.name}`);
    console.log(`[MACHINE] Project ID: ${machine.project_id}`);
    console.log(`[MACHINE] Current Status: ${machine.status}`);

    // Step 1: Generate image
    if (machine.status === 'pending') {
      console.log(`[MACHINE] ── Step 1: Generating Image ──`);
      await updateMachineStatus(machineId, 'generating_image');
      console.log(`[MACHINE] ✓ Status updated to: generating_image`);
      
      try {
        const imagePrompt = machine.appearance || machine.description || machine.name;
        console.log(`[MACHINE] Image prompt: "${imagePrompt}"`);
        console.log(`[MACHINE] Calling image generation service...`);
        
        const imageStartTime = Date.now();
        const imageUrl = await generateImage(imagePrompt);
        const imageDuration = Date.now() - imageStartTime;
        
        console.log(`[MACHINE] ✓ Image generated successfully (${imageDuration}ms)`);
        console.log(`[MACHINE] Image URL: ${imageUrl.substring(0, 50)}...`);
        
        await updateMachineStatus(machineId, 'generating_3d_model', {
          generated_image: imageUrl,
        } as Partial<Machine>);
        console.log(`[MACHINE] ✓ Status updated to: generating_3d_model`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[MACHINE] ✗ Image generation failed: ${errorMessage}`);
        await updateMachineStatus(machineId, 'previous', {
          error_message: `Image generation failed: ${errorMessage}`,
        } as Partial<Machine>);
        console.log(`[MACHINE] ⏳ Scheduling retry in 5 seconds...`);
        // Retry after few seconds
        setTimeout(() => {
          processMachineGeneration(machineId).catch(console.error);
        }, 5000);
        return;
      }
    }

    // Step 2: Generate 3D model
    const currentMachine = await supabaseAdmin
      .from('machines')
      .select('*')
      .eq('id', machineId)
      .single();

    if (currentMachine.data && 
        (currentMachine.data.status === 'generating_3d_model' || 
         (currentMachine.data.generated_image && !currentMachine.data.generated_3d_model))) {
      console.log(`[MACHINE] ── Step 2: Generating 3D Model ──`);
      await updateMachineStatus(machineId, 'generating_3d_model');
      console.log(`[MACHINE] ✓ Status confirmed: generating_3d_model`);
      
      try {
        const modelPrompt = currentMachine.data.appearance || currentMachine.data.description || '';
        console.log(`[MACHINE] 3D model prompt: "${modelPrompt}"`);
        console.log(`[MACHINE] Calling 3D model generation service...`);
        
        const modelStartTime = Date.now();
        const modelUrl = await generate3DModel(
          currentMachine.data.generated_image || '',
          modelPrompt
        );
        const modelDuration = Date.now() - modelStartTime;
        
        console.log(`[MACHINE] ✓ 3D model generated successfully (${modelDuration}ms)`);
        console.log(`[MACHINE] Model URL: ${modelUrl}`);
        
        await updateMachineStatus(machineId, 'completed', {
          generated_3d_model: modelUrl,
        } as Partial<Machine>);
        console.log(`[MACHINE] ✓ Status updated to: completed`);

        // Check if all machines are completed
        console.log(`[MACHINE] Checking if all machines for project are completed...`);
        const allCompleted = await checkAllMachinesCompleted(currentMachine.data.project_id);
        if (allCompleted) {
          console.log(`[MACHINE] ⚡ ALL MACHINES COMPLETED! Project status updated to PROJECT_COMPLETED`);
        } else {
          console.log(`[MACHINE] → Other machines still processing...`);
        }
        
        const totalDuration = Date.now() - startTime;
        console.log(`[MACHINE] ═══ Machine Generation Complete ═══`);
        console.log(`[MACHINE] Total execution time: ${totalDuration}ms`);
        console.log(`[MACHINE] ========== Machine Generation Finished ==========\n`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[MACHINE] ✗ 3D model generation failed: ${errorMessage}`);
        await updateMachineStatus(machineId, 'previous', {
          error_message: `3D model generation failed: ${errorMessage}`,
        } as Partial<Machine>);
        console.log(`[MACHINE] ⏳ Scheduling retry in 5 seconds...`);
        // Retry after few seconds
        setTimeout(() => {
          processMachineGeneration(machineId).catch(console.error);
        }, 5000);
        return;
      }
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[MACHINE] ✗ ERROR processing machine generation: ${errorMessage}`);
    console.error(`[MACHINE] Error stack:`, error instanceof Error ? error.stack : String(error));
    // Update to previous status and retry
    await updateMachineStatus(machineId, 'previous', {
      error_message: errorMessage,
    } as Partial<Machine>);
    console.log(`[MACHINE] ⏳ Scheduling retry in 5 seconds...`);
    setTimeout(() => {
      processMachineGeneration(machineId).catch(console.error);
    }, 5000);
    console.log(`[MACHINE] ========== Machine Generation Failed ==========\n`);
  }
}

/**
 * Retry machine generation (for machines in PREVIOUS status)
 */
export async function retryMachineGeneration(machineId: string): Promise<void> {
  const { data: machine } = await supabaseAdmin
    .from('machines')
    .select('*')
    .eq('id', machineId)
    .single();

  if (machine && machine.status === 'previous') {
    // Reset to pending if no image, or to generating_3d_model if image exists
    const newStatus: MachineStatus = machine.generated_image 
      ? 'generating_3d_model'
      : 'pending';
    
    await updateMachineStatus(machineId, newStatus, {
      error_message: null,
    } as Partial<Machine>);
    
    await processMachineGeneration(machineId);
  }
}

