/**
 * Project Workflow Orchestration
 * 
 * Manages the complete 6-step production line planning workflow:
 * 1. DATA_COLLECTING - Collect requirements and information
 * 2. CREATING_PROCCES - Create production line plan
 * 3. ASSETS_RESEARCH - Research assets (machines, equipment) with suppliers
 * 4. GENERATING_2D_LAYOUT - Generate 2D layout visualization
 * 5. GENERATING_3D_MODEL - Generate 3D model/CAD file
 * 6. PROJECT_COMPLETED - Generate PDF report and close project
 */

import {
  getProject,
  updateProjectStatus,
  saveDataCollectingResult,
} from '../services/projectService.js';
import {
  sendChatMessage,
  extractStatusChange,
} from '../services/chatService.js';
import {
  createAssets,
  completeAsset,
  checkAllAssetsCompleted,
  getProjectAssets,
} from '../services/assetService.js';
import { generate2DLayout } from '../services/layoutService.js';
import { generate3DModel } from '../services/model3dService.js';
import { generatePDFReport } from '../services/reportService.js';
import { autoProgressWorkflow } from '../services/workflowAutoProgress.js';
import { AssetInput, ProjectStatus } from '../types/index.js';
import { supabaseAdmin } from '../config/supabase.js';

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
      // Default: move to next step in sequence
      const stepOrder: ProjectStatus[] = [
        'DATA_COLLECTING',
        'CREATING_PROCCES',
        'ASSETS_RESEARCH',
        'GENERATING_2D_LAYOUT',
        'GENERATING_3D_MODEL',
        'PROJECT_COMPLETED',
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
        const { getConversationHistory } = await import('../services/chatService.js');
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
        if (targetStatus !== 'ASSETS_RESEARCH') {
          throw new Error(`Invalid transition from CREATING_PROCCES to ${targetStatus}`);
        }
        
        const updatedProject = await updateProjectStatus(projectId, 'ASSETS_RESEARCH');
        console.log(`[WORKFLOW] ✓ Transitioned to ASSETS_RESEARCH`);
        
        // Send a message to AI to start researching assets
        const response = await sendChatMessage(projectId, 'Please research and identify all assets (machines, equipment, tools) and suppliers needed for this production line. For each asset type, provide exactly 3 alternatives from different suppliers.');
        
        // Assets will be created via structured output in sendChatMessage
        // The workflow will continue after assets are extracted and created
        
        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] Total execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Manual Step Trigger Complete ==========\n`);
        
        return {
          message: response.message,
          projectStatus: updatedProject.status,
        };
      }
      
      case 'ASSETS_RESEARCH': {
        // Assets research phase - handle in executeWorkflow when assets are extracted
        if (targetStatus !== 'GENERATING_2D_LAYOUT') {
          throw new Error(`Invalid transition from ASSETS_RESEARCH to ${targetStatus}`);
        }
        
        // Check if all assets are completed
        const allCompleted = await checkAllAssetsCompleted(projectId);
        if (!allCompleted) {
          throw new Error('Cannot transition to 2D layout. Assets research must be completed first.');
        }
        
        const updatedProject = await updateProjectStatus(projectId, 'GENERATING_2D_LAYOUT');
        console.log(`[WORKFLOW] ✓ Transitioned to GENERATING_2D_LAYOUT`);
        
        // Generate 2D layout
        const assets = await getProjectAssets(projectId);
        const processPlan = project.creating_procces_result || {};
        
        console.log(`[WORKFLOW] Generating 2D layout with ${assets.length} assets...`);
        const layoutUrl = await generate2DLayout(projectId, assets, processPlan);
        
        // Update project with layout URL
        await supabaseAdmin
          .from('projects')
          .update({ layout_2d_url: layoutUrl })
          .eq('id', projectId);
        
        console.log(`[WORKFLOW] ✓ 2D layout generated: ${layoutUrl}`);
        
        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] Total execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Manual Step Trigger Complete ==========\n`);
        
        return {
          message: `2D layout generated successfully. Layout URL: ${layoutUrl}`,
          projectStatus: updatedProject.status,
        };
      }
      
      case 'GENERATING_2D_LAYOUT': {
        if (targetStatus !== 'GENERATING_3D_MODEL') {
          throw new Error(`Invalid transition from GENERATING_2D_LAYOUT to ${targetStatus}`);
        }
        
        const currentProject = await getProject(projectId);
        if (!currentProject.layout_2d_url) {
          throw new Error('Cannot transition to 3D model. 2D layout must be generated first.');
        }
        
        const updatedProject = await updateProjectStatus(projectId, 'GENERATING_3D_MODEL');
        console.log(`[WORKFLOW] ✓ Transitioned to GENERATING_3D_MODEL`);
        
        // Generate 3D model
        const assets = await getProjectAssets(projectId);
        
        console.log(`[WORKFLOW] Generating 3D model with ${assets.length} assets...`);
        const modelUrl = await generate3DModel(projectId, assets, currentProject.layout_2d_url);
        
        // Update project with 3D model URL
        await supabaseAdmin
          .from('projects')
          .update({ model_3d_url: modelUrl })
          .eq('id', projectId);
        
        console.log(`[WORKFLOW] ✓ 3D model generated: ${modelUrl}`);
        
        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] Total execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Manual Step Trigger Complete ==========\n`);
        
        return {
          message: `3D model generated successfully. Model URL: ${modelUrl}`,
          projectStatus: updatedProject.status,
        };
      }
      
      case 'GENERATING_3D_MODEL': {
        if (targetStatus !== 'PROJECT_COMPLETED') {
          throw new Error(`Invalid transition from GENERATING_3D_MODEL to ${targetStatus}`);
        }
        
        const currentProject = await getProject(projectId);
        if (!currentProject.model_3d_url) {
          throw new Error('Cannot transition to report generation. 3D model must be generated first.');
        }
        
        const updatedProject = await updateProjectStatus(projectId, 'PROJECT_COMPLETED');
        console.log(`[WORKFLOW] ✓ Transitioned to PROJECT_COMPLETED`);
        
        // Generate PDF report
        const assets = await getProjectAssets(projectId);
        const processPlan = currentProject.creating_procces_result || {};
        
        console.log(`[WORKFLOW] Generating PDF report...`);
        const reportUrl = await generatePDFReport(
          projectId,
          {
            name: currentProject.name,
            description: currentProject.description,
            data_collecting_result: currentProject.data_collecting_result,
            creating_procces_result: processPlan,
          },
          assets,
          processPlan,
          currentProject.layout_2d_url || '',
          currentProject.model_3d_url || ''
        );
        
        // Update project with report URL
        await supabaseAdmin
          .from('projects')
          .update({ report_pdf_url: reportUrl })
          .eq('id', projectId);
        
        console.log(`[WORKFLOW] ✓ PDF report generated: ${reportUrl}`);
        console.log(`[WORKFLOW] ⚡ PROJECT COMPLETED!`);
        
        const totalDuration = Date.now() - startTime;
        console.log(`[WORKFLOW] Total execution time: ${totalDuration}ms`);
        console.log(`[WORKFLOW] ========== Manual Step Trigger Complete ==========\n`);
        
        return {
          message: `Project completed! PDF report generated: ${reportUrl}`,
          projectStatus: updatedProject.status,
        };
      }
      
      case 'PROJECT_COMPLETED': {
        console.log(`[WORKFLOW] Project is already completed`);
        const response = await sendChatMessage(projectId, 'The project is already completed. You can view the final report and all generated assets.');
        
        return {
          message: response.message,
          projectStatus: project.status,
        };
      }
      
      default:
        throw new Error(`Unknown project status: ${project.status}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WORKFLOW] ✗ ERROR in manual step trigger (${Date.now() - startTime}ms):`, errorMessage);
    throw error;
  }
}

/**
 * Execute workflow based on chat message and current status
 * Handles automatic workflow transitions when AI signals status changes
 */
export async function executeWorkflow(
  projectId: string,
  userMessage: string
): Promise<{ message: string; projectStatus: ProjectStatus }> {
  const startTime = Date.now();
  const project = await getProject(projectId);
  
  console.log(`\n[WORKFLOW] ========== Workflow Execution Started ==========`);
  console.log(`[WORKFLOW] Project ID: ${projectId}`);
  console.log(`[WORKFLOW] Project Name: ${project.name}`);
  console.log(`[WORKFLOW] Current Status: ${project.status}`);
  console.log(`[WORKFLOW] User Message: ${userMessage}`);
  console.log(`[WORKFLOW] Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Send message to AI and get response
    const aiStartTime = Date.now();
    const response = await sendChatMessage(projectId, userMessage);
    const aiDuration = Date.now() - aiStartTime;
    
    console.log(`[WORKFLOW] ── Phase: ${project.status} ──`);
    console.log(`[WORKFLOW] ✓ Chat response received (${aiDuration}ms)`);
    
    // Handle assets extraction for ASSETS_RESEARCH phase
    if (project.status === 'ASSETS_RESEARCH' && response.assets && response.assets.length > 0) {
      console.log(`[WORKFLOW] ⚡ Extracted ${response.assets.length} assets from structured output`);
      
      // Create assets in database
      console.log(`[WORKFLOW] Creating asset records in database...`);
      const createdAssets = await createAssets(projectId, response.assets as AssetInput[]);
      console.log(`[WORKFLOW] ✓ Created ${createdAssets.length} asset records`);
      
      // Mark all assets as completed (research phase done)
      for (const asset of createdAssets) {
        await completeAsset(asset.id);
      }
      console.log(`[WORKFLOW] ✓ All assets marked as completed`);
      
      // Auto-progress to next step
      console.log(`[WORKFLOW] Auto-progressing to next step...`);
      await autoProgressWorkflow(projectId);
    }
    
    // Check for status change in AI response
    const statusChange = extractStatusChange(response.message);
    if (statusChange && statusChange !== project.status) {
      console.log(`[WORKFLOW] ⚡ Status change detected: ${project.status} → ${statusChange}`);
      
      // Transition to next status
      const updatedProject = await updateProjectStatus(projectId, statusChange);
      console.log(`[WORKFLOW] ✓ Transitioned to ${statusChange}`);
      
      // Auto-progress workflow after status change
      // This will automatically move through steps 2-6 as they complete
      await autoProgressWorkflow(projectId);
      
      // Reload project to get updated status
      const finalProject = await getProject(projectId);
      
      const totalDuration = Date.now() - startTime;
      console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
      console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);
      
      return {
        message: response.message,
        projectStatus: finalProject.status,
      };
    } else {
      // Even without explicit status change, check if we can auto-progress
      await autoProgressWorkflow(projectId);
      
      // Reload project to get updated status
      const finalProject = await getProject(projectId);
      
      const totalDuration = Date.now() - startTime;
      console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
      console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);
      
      return {
        message: response.message,
        projectStatus: finalProject.status,
      };
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`[WORKFLOW] Execution time: ${totalDuration}ms`);
    console.log(`[WORKFLOW] ========== Workflow Execution Complete ==========\n`);
    
    return {
      message: response.message,
      projectStatus: project.status,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[WORKFLOW] ✗ ERROR in workflow execution (${Date.now() - startTime}ms):`, errorMessage);
    console.error(`[WORKFLOW] Error stack:`, error instanceof Error ? error.stack : String(error));
    throw error;
  }
}
