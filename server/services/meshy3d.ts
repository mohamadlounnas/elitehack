/**
 * Meshy3D service integration
 * Currently bypassed with 3-second delay and fake URL
 */

/**
 * Generate 3D model from image
 * @param _imageUrl - URL of the image to convert (unused in bypass mode)
 * @param _prompt - Description prompt (unused in bypass mode)
 * @returns Promise<string> 3D model URL
 */
export async function generate3DModel(_imageUrl: string, _prompt: string): Promise<string> {
  // Bypass implementation: wait 3 seconds and return fake URL
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Return fake 3D model URL
  return `https://fake-meshy3d-storage.com/models/${Date.now()}.obj`;
}

/**
 * Check 3D model generation status (for real implementation)
 * @param taskId - Meshy3D task ID
 * @returns Promise<{status: string, url?: string}>
 */
export async function check3DModelStatus(taskId: string): Promise<{status: string; url?: string}> {
  // Placeholder for future implementation
  return {
    status: 'completed',
    url: `https://fake-meshy3d-storage.com/models/${taskId}.obj`,
  };
}

