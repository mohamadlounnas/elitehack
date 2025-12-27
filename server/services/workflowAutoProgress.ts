/**
 * Workflow Auto-Progress Service
 * Automatically progresses workflow steps when conditions are met
 */

import { getProject, updateProjectStatus } from './projectService.js';
import { checkAllAssetsCompleted, getProjectAssets } from './assetService.js';
import { generate2DLayout } from './layoutService.js';
import { generate3DModel } from './model3dService.js';
import { generatePDFReport } from './reportService.js';
import { sendChatMessage } from './chatService.js';
import { ProjectStatus } from '../types/index.js';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Check if current step is complete and automatically progress to next step
 * 
 * @param projectId - Project ID to check and progress
 * @returns True if step was progressed, false otherwise
 */
export async function autoProgressWorkflow(projectId: string): Promise<boolean> {
  try {
    const project = await getProject(projectId);
    console.log(`[AUTO-PROGRESS] Checking auto-progress for project ${projectId}, status: ${project.status}`);
    
    switch (project.status) {
      case 'CREATING_PROCCES': {
        // Step 2: Process planning is complete when we have a process result
        if (project.creating_procces_result) {
          console.log(`[AUTO-PROGRESS] Step 2 complete, progressing to Step 3 (ASSETS_RESEARCH)`);
          await updateProjectStatus(projectId, 'ASSETS_RESEARCH');
          
          // Trigger assets research by sending a message
          const { sendChatMessage } = await import('./chatService.js');
          await sendChatMessage(
            projectId,
            'Please research and identify all assets (machines, equipment, tools) and suppliers needed for this production line. For each asset type, provide exactly 3 alternatives from different suppliers.'
          );
          
          return true;
        }
        break;
      }
      
      case 'ASSETS_RESEARCH': {
        // Step 3: Assets research is complete when all assets are completed
        const allCompleted = await checkAllAssetsCompleted(projectId);
        if (allCompleted) {
          console.log(`[AUTO-PROGRESS] Step 3 complete, progressing to Step 4 (GENERATING_2D_LAYOUT)`);
          await updateProjectStatus(projectId, 'GENERATING_2D_LAYOUT');
          
          // Generate 2D layout
          const assets = await getProjectAssets(projectId);
          const processPlan = project.creating_procces_result || {};
          console.log(`[AUTO-PROGRESS] Generating 2D layout with ${assets.length} assets`);
          const layoutUrl = await generate2DLayout(projectId, assets, processPlan);
          
          // Update project with layout URL
          await supabaseAdmin
            .from('projects')
            .update({ layout_2d_url: layoutUrl })
            .eq('id', projectId);
          
          console.log(`[AUTO-PROGRESS] 2D layout generated: ${layoutUrl}`);
          
          // Recursively check for next progression
          await autoProgressWorkflow(projectId);
          
          return true;
        }
        break;
      }
      
      case 'GENERATING_2D_LAYOUT': {
        // Step 4: 2D layout is complete when we have a layout URL
        if (project.layout_2d_url) {
          console.log(`[AUTO-PROGRESS] Step 4 complete, progressing to Step 5 (GENERATING_3D_MODEL)`);
          await updateProjectStatus(projectId, 'GENERATING_3D_MODEL');
          
          // Generate 3D model
          const assets = await getProjectAssets(projectId);
          console.log(`[AUTO-PROGRESS] Generating 3D model with ${assets.length} assets`);
          const modelUrl = await generate3DModel(projectId, assets, project.layout_2d_url);
          
          // Update project with 3D model URL
          await supabaseAdmin
            .from('projects')
            .update({ model_3d_url: modelUrl })
            .eq('id', projectId);
          
          console.log(`[AUTO-PROGRESS] 3D model generated: ${modelUrl}`);
          
          // Recursively check for next progression
          await autoProgressWorkflow(projectId);
          
          return true;
        }
        break;
      }
      
      case 'GENERATING_3D_MODEL': {
        // Step 5: 3D model is complete when we have a model URL
        if (project.model_3d_url) {
          console.log(`[AUTO-PROGRESS] Step 5 complete, progressing to Step 6 (PROJECT_COMPLETED)`);
          await updateProjectStatus(projectId, 'PROJECT_COMPLETED');
          
          // Generate PDF report
          const assets = await getProjectAssets(projectId);
          const processPlan = project.creating_procces_result || {};
          console.log(`[AUTO-PROGRESS] Generating PDF report`);
          const reportUrl = await generatePDFReport(
            projectId,
            {
              name: project.name,
              description: project.description,
              data_collecting_result: project.data_collecting_result,
              creating_procces_result: processPlan,
            },
            assets,
            processPlan,
            project.layout_2d_url || '',
            project.model_3d_url || ''
          );
          
          // Update project with report URL
          await supabaseAdmin
            .from('projects')
            .update({ report_pdf_url: reportUrl })
            .eq('id', projectId);
          
          console.log(`[AUTO-PROGRESS] PDF report generated: ${reportUrl}`);
          console.log(`[AUTO-PROGRESS] ⚡ PROJECT COMPLETED!`);
          
          return true;
        }
        break;
      }
      
      case 'PROJECT_COMPLETED':
        // Project is complete, no further progression
        return false;
      
      case 'DATA_COLLECTING':
        // Step 1: Manual transition or AI status change triggers progression
        return false;
    }
    
    return false;
  } catch (error) {
    console.error(`[AUTO-PROGRESS] Error auto-progressing workflow:`, error);
    return false;
  }
}

