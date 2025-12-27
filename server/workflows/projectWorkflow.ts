/**
 * Project workflow orchestration
 * IMPROVED: More reliable and proactive workflow execution
 */

import {
  getProject,
  updateProjectStatus,
  saveDataCollectingResult,
} from '../services/projectService.js';
import {
  sendChatMessage,
  extractStatusChange,
  extractMachinesList,
  getConversationHistory,
} from '../services/chatService.js';
import {
  createMachines,
  processMachineGeneration,
} from '../services/machineService.js';
import { MachineInput, ProjectStatus } from '../types/index.js';

/**
 * Manually trigger workflow step transition
 */
export async function triggerWorkflowStep(
  projectId: string,
  targetStep?: ProjectStatus
): Promise<{ message: string; projectStatus: ProjectStatus }> {
  const startTime = Date.now();
  const project = await getProject(projectId);
  
  console.log(`\n[WORKFLOW] ========== Manual Step Trigger ==========`);
  console.log(`[WORKFLOW] Project ID: ${projectId}`);
  console.log(`[WORKFLOW] Current Status: ${project.status}`);
  console.log(`[WORKFLOW] Target Step: ${targetStep || 'next'}`);
  
  try {
    // Determine target step based on current status
    let targetStatus: ProjectStatus;
    if (targetStep) {
      targetStatus = targetStep;
    } else {
      // Default: move to next step
      const stepOrder: ProjectStatus[] = [
        'DATA_COLLECTING',
        'CREATING_PROCCES',
        'MACHINES_REASERCH',
        'MACHINES_GENERATED',
      ];
      const currentIndex = stepOrder.indexOf(project.status);
      if (currentIndex === -1 || currentIndex === stepOrder.length - 1) {
        throw new Error(`Cannot transition from ${project.status}`);
      }
      targetStatus = stepOrder[currentIndex + 1];
    }
    
    console.log(`[WORKFLOW] Triggering transition: ${project.status} → ${targetStatus}`);
    
    switch (project.status) {
      case 'DATA_COLLECTING': {
        if (targetStatus !== 'CREATING_PROCCES') {
          throw new Error(`Invalid transition from DATA_COLLECTING to ${targetStatus}`);
        }
        
        // Save collected data before transitioning
        const history = await getConversationHistory(projectId);
        await saveDataCollectingResult(projectId, {
          conversation: history,
          summary: 'Manual transition triggered by user',
          collectedAt: new Date().toISOString(),
        });
        
        const updatedProject = await updateProjectStatus(projectId, 'CREATING_PROCCES');
        console.log(`[WORKFLOW] ✓ Transitioned to CREATING_PROCCES`);
        
        // Send a message to AI to start creating the process
        const response = await sendChatMessage(projectId, 'Please create the production line plan now based on all collected information.');
        
        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] Total execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Manual Step Trigger Complete ==========\n`);
        
        return {
          message: response.message,
          projectStatus: updatedProject.status,
        };
      }
      
      case 'CREATING_PROCCES': {
        if (targetStatus !== 'MACHINES_REASERCH') {
          throw new Error(`Invalid transition from CREATING_PROCCES to ${targetStatus}`);
        }
        
        const updatedProject = await updateProjectStatus(projectId, 'MACHINES_REASERCH', {
          processReport: 'Manual transition triggered by user',
          createdAt: new Date().toISOString(),
        });
        console.log(`[WORKFLOW] ✓ Transitioned to MACHINES_REASERCH`);
        
        // Send a message to AI to start researching machines
        console.log(`[WORKFLOW] Requesting AI to research machines...`);
        const response = await sendChatMessage(projectId, 'Please research and identify all machines, equipment, and suppliers needed for this production line. Provide them in the [MACHINES] JSON format.');
        
        // Try to extract machines from the response
        const machines = extractMachinesList(response.message);
        
        if (machines && Array.isArray(machines) && machines.length > 0) {
          console.log(`[WORKFLOW] ⚡ Extracted ${machines.length} machines from AI response`);
          
          // Create machine entries
          console.log(`[WORKFLOW] Creating machine records in database...`);
          const createdMachines = await createMachines(projectId, machines as MachineInput[]);
          console.log(`[WORKFLOW] ✓ Created ${createdMachines.length} machine records`);

          // Start generation process for each machine
          console.log(`[WORKFLOW] Starting machine generation process...`);
          for (const machine of createdMachines) {
            console.log(`[WORKFLOW]   Starting generation for machine: ${machine.name} (ID: ${machine.id})`);
            processMachineGeneration(machine.id)
              .then(() => {
                console.log(`[WORKFLOW]   ✓ Machine ${machine.name} generation completed`);
              })
              .catch((err) => {
                console.error(`[WORKFLOW]   ✗ Error processing machine ${machine.id}:`, err);
              });
          }
        } else {
          console.log(`[WORKFLOW] ⚠ No machines extracted from response - may need to ask AI again`);
        }
        
        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] Total execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Manual Step Trigger Complete ==========\n`);
        
        return {
          message: response.message,
          projectStatus: updatedProject.status,
        };
      }
      
      case 'MACHINES_REASERCH': {
        // Can't manually skip to MACHINES_GENERATED - must wait for machines to complete
        throw new Error('Cannot manually transition from MACHINES_REASERCH. Machines must complete generation first.');
      }
      
      case 'MACHINES_GENERATED': {
        throw new Error('Project is already complete. No further transitions available.');
      }
      
      default:
        throw new Error(`Unknown project status: ${project.status}`);
    }
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[WORKFLOW] ✗ ERROR in manual step trigger (${totalDuration}ms):`, error);
    console.error(`[WORKFLOW] ========== Manual Step Trigger Failed ==========\n`);
    throw error;
  }
}

/**
 * Execute project workflow step based on current project status
 * IMPROVED: Comprehensive logging and progress tracking
 */
export async function executeProjectWorkflow(
  projectId: string,
  userMessage: string
): Promise<{ message: string; status?: string; machinesCreated?: number; projectStatus?: ProjectStatus }> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Get current project status
  const project = await getProject(projectId);
  
  console.log(`\n[WORKFLOW] ========== Workflow Execution Started ==========`);
  console.log(`[WORKFLOW] Project ID: ${projectId}`);
  console.log(`[WORKFLOW] Project Name: ${project.name}`);
  console.log(`[WORKFLOW] Current Status: ${project.status}`);
  console.log(`[WORKFLOW] User Message: ${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}`);
  console.log(`[WORKFLOW] Timestamp: ${timestamp}`);
  
  try {
    switch (project.status) {
      case 'DATA_COLLECTING': {
        console.log(`[WORKFLOW] ── Phase: DATA_COLLECTING ──`);
        console.log(`[WORKFLOW] Sending message to AI for data collection...`);
        
        // Send message to AI and get response
        const aiStartTime = Date.now();
        const response = await sendChatMessage(projectId, userMessage);
        const aiDuration = Date.now() - aiStartTime;
        
        console.log(`[WORKFLOW] ✓ AI Response received (${aiDuration}ms)`);
        console.log(`[WORKFLOW] Response length: ${response.message.length} characters`);

        // Check if AI wants to transition to next phase
        const statusChange = extractStatusChange(response.message);

        if (statusChange === 'CREATING_PROCCES') {
          console.log(`[WORKFLOW] ⚡ Status change detected: CREATING_PROCCES`);
          console.log(`[WORKFLOW] Saving data collection results...`);
          
          // Save collected data
          const history = await getConversationHistory(projectId);
          await saveDataCollectingResult(projectId, {
            conversation: history,
            summary: response.message,
            collectedAt: new Date().toISOString(),
          });
          
          console.log(`[WORKFLOW] ✓ Saved ${history.length} conversation messages`);

          // Update project status
          console.log(`[WORKFLOW] Updating project status to CREATING_PROCCES...`);
          const updatedProject = await updateProjectStatus(projectId, 'CREATING_PROCCES');
          const totalDuration = Date.now() - startTime;
          
          console.log(`[WORKFLOW] ✓ Status updated successfully`);
          console.log(`[WORKFLOW] ═══ Phase Transition Complete ═══`);
          console.log(`[WORKFLOW] Total execution time: ${totalDuration}ms`);
          console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);

          return {
            message: response.message,
            status: 'completed',
            projectStatus: updatedProject.status,
          };
        }

        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] → Continuing data collection phase`);
        console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);

        return {
          message: response.message,
          status: 'continue',
          projectStatus: project.status,
        };
      }

      case 'CREATING_PROCCES': {
        console.log(`[WORKFLOW] ── Phase: CREATING_PROCCES ──`);
        console.log(`[WORKFLOW] Requesting AI to create production process plan...`);
        
        // Send message to AI (it will create the production process)
        const aiStartTime = Date.now();
        const response = await sendChatMessage(projectId, userMessage);
        const aiDuration = Date.now() - aiStartTime;
        
        console.log(`[WORKFLOW] ✓ AI Process Plan received (${aiDuration}ms)`);
        console.log(`[WORKFLOW] Process plan length: ${response.message.length} characters`);

        // Check if AI wants to transition to machine research
        const statusChange = extractStatusChange(response.message);

        if (statusChange === 'MACHINES_REASERCH') {
          console.log(`[WORKFLOW] ⚡ Status change detected: MACHINES_REASERCH`);
          console.log(`[WORKFLOW] Saving process creation results...`);
          
          // Save process creation result and update status
          const updatedProject = await updateProjectStatus(projectId, 'MACHINES_REASERCH', {
            processReport: response.message,
            createdAt: new Date().toISOString(),
          });
          
          const totalDuration = Date.now() - startTime;
          console.log(`[WORKFLOW] ✓ Process plan saved and status updated`);
          console.log(`[WORKFLOW] ═══ Phase Transition Complete ═══`);
          console.log(`[WORKFLOW] Total execution time: ${totalDuration}ms`);
          console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);

          return {
            message: response.message,
            status: 'completed',
            projectStatus: updatedProject.status,
          };
        }

        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] → Continuing process creation phase`);
        console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);

        return {
          message: response.message,
          status: 'continue',
          projectStatus: project.status,
        };
      }

      case 'MACHINES_REASERCH': {
        console.log(`[WORKFLOW] ── Phase: MACHINES_REASERCH ──`);
        console.log(`[WORKFLOW] Requesting AI to research machines and suppliers with structured output...`);
        
        // Send message to AI with structured output enabled
        const aiStartTime = Date.now();
        const response = await sendChatMessage(projectId, userMessage);
        const aiDuration = Date.now() - aiStartTime;
        
        console.log(`[WORKFLOW] ✓ AI Machine Research received (${aiDuration}ms)`);
        console.log(`[WORKFLOW] Response length: ${response.message.length} characters`);

        // Use structured output data if available (preferred method)
        let machines: MachineInput[] | null = null;
        
        if (response.machines && Array.isArray(response.machines) && response.machines.length > 0) {
          console.log(`[WORKFLOW] ⚡ Using structured output: ${response.machines.length} machines extracted`);
          machines = response.machines as MachineInput[];
        } else {
          // Fallback to JSON parsing (deprecated but kept for compatibility)
          console.log(`[WORKFLOW] ⚠ No structured output, falling back to JSON parsing`);
          const extractedMachines = extractMachinesList(response.message);
          if (extractedMachines) {
            machines = extractedMachines as MachineInput[];
          }
        }

        if (machines && machines.length > 0) {
          console.log(`[WORKFLOW] ⚡ Processing ${machines.length} machines`);
          machines.forEach((m, idx) => {
            console.log(`[WORKFLOW]   Machine ${idx + 1}: ${m.name || 'Unnamed'}`);
          });
          
          console.log(`[WORKFLOW] Creating machine records in database...`);
          // Create machine entries
          const createdMachines = await createMachines(projectId, machines);
          console.log(`[WORKFLOW] ✓ Created ${createdMachines.length} machine records`);

          console.log(`[WORKFLOW] Starting machine generation process (image + 3D model)...`);
          // Start generation process for each machine asynchronously
          let startedCount = 0;
          for (const machine of createdMachines) {
            startedCount++;
            console.log(`[WORKFLOW]   Starting generation for machine ${startedCount}/${createdMachines.length}: ${machine.name} (ID: ${machine.id})`);
            // Process asynchronously without blocking
            processMachineGeneration(machine.id)
              .then(() => {
                console.log(`[WORKFLOW]   ✓ Machine ${machine.name} generation completed`);
              })
              .catch((err) => {
                console.error(`[WORKFLOW]   ✗ Error processing machine ${machine.id} (${machine.name}):`, err);
              });
          }
          
          const totalDuration = Date.now() - startTime;
          console.log(`[WORKFLOW] ✓ All machine generation processes started`);
          console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
          console.log(`[WORKFLOW] Note: Project status will auto-update to MACHINES_GENERATED when all machines complete`);
          console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);

          return {
            message: response.message,
            machinesCreated: createdMachines.length,
            projectStatus: project.status,
          };
        }

        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] ⚠ No machines extracted from response`);
        console.log(`[WORKFLOW] Response preview:`, response.message.substring(0, 300));
        console.log(`[WORKFLOW] → Continuing research phase - user may need to ask AI again`);
        console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);

        return {
          message: response.message,
          projectStatus: project.status,
        };
      }

      case 'MACHINES_GENERATED': {
        console.log(`[WORKFLOW] ── Phase: MACHINES_GENERATED ──`);
        
        // Check if user wants to regenerate machines
        const regenerateKeywords = ['retry', 'regenerate', 'generate full', 'regenerate machines', 'redo'];
        const wantsRegenerate = regenerateKeywords.some(keyword => 
          userMessage.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (wantsRegenerate) {
          console.log(`[WORKFLOW] ⚡ Regeneration requested - moving back to MACHINES_REASERCH`);
          
          // Move back to machine research phase
          const updatedProject = await updateProjectStatus(projectId, 'MACHINES_REASERCH', {
            processReport: 'Regeneration requested by user',
            createdAt: new Date().toISOString(),
          });
          
          // Request AI to research machines again
          const response = await sendChatMessage(projectId, 'Please research and identify all machines, equipment, and suppliers needed for this production line. Provide them in the [MACHINES] JSON format with 3 alternatives for each machine type.');
          
          // Try to extract machines
          const machines = extractMachinesList(response.message);
          
          if (machines && Array.isArray(machines) && machines.length > 0) {
            console.log(`[WORKFLOW] ⚡ Extracted ${machines.length} machines from regeneration response`);
            
            // Delete old machines and create new ones
            const { getProjectMachines } = await import('../services/machineService.js');
            const oldMachines = await getProjectMachines(projectId);
            const { supabaseAdmin } = await import('../config/supabase.js');
            
            if (oldMachines.length > 0) {
              await supabaseAdmin
                .from('machines')
                .delete()
                .eq('project_id', projectId);
              console.log(`[WORKFLOW] ✓ Deleted ${oldMachines.length} old machines`);
            }
            
            // Create new machines
            const createdMachines = await createMachines(projectId, machines as MachineInput[]);
            console.log(`[WORKFLOW] ✓ Created ${createdMachines.length} new machine records`);

            // Start generation process
            for (const machine of createdMachines) {
              processMachineGeneration(machine.id)
                .then(() => {
                  console.log(`[WORKFLOW]   ✓ Machine ${machine.name} generation completed`);
                })
                .catch((err) => {
                  console.error(`[WORKFLOW]   ✗ Error processing machine ${machine.id}:`, err);
                });
            }
          }
          
          const totalDuration = Date.now() - startTime;
          console.log(`[WORKFLOW] ✓ Regeneration initiated`);
          console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
          console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);
          
          return {
            message: response.message,
            projectStatus: updatedProject.status,
          };
        }
        
        // Regular chat response for completed project
        console.log(`[WORKFLOW] Project complete - handling chat message...`);
        const aiStartTime = Date.now();
        const response = await sendChatMessage(projectId, userMessage);
        const aiDuration = Date.now() - aiStartTime;
        
        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] ✓ Chat response received (${aiDuration}ms)`);
        console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);
        
        return {
          message: response.message,
          projectStatus: project.status,
        };
      }

      default:
        console.error(`[WORKFLOW] ✗ Unknown project status: ${project.status}`);
        throw new Error(`Unknown project status: ${project.status}`);
    }
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    console.error(`[WORKFLOW] ✗ ERROR in workflow execution (${totalDuration}ms):`, error);
    console.error(`[WORKFLOW] Error details:`, error instanceof Error ? error.message : String(error));
    console.error(`[WORKFLOW] ========== Workflow Execution Failed ==========\n`);
    throw error;
  }
}
