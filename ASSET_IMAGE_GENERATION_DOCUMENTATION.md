# Asset Image Generation Documentation

## Overview

The asset image generation system uses Google's Gemini 2.5 Flash Image model to generate professional product images for factory assets based on their appearance descriptions.

## Location

**Service File:** `backend/src/services/imageGeneration.ts`

## Core Logic Flow

### 1. Entry Points

The service provides two main methods for generating images:

#### A. `generateImagesForProjectWithStream(projectId, onUpdate)`
- **Purpose:** Generates images with real-time streaming updates
- **Use Case:** Used when frontend needs progress updates during generation
- **Features:**
  - Sends progress updates via callback
  - Prevents duplicate execution using project lock
  - Handles errors gracefully per asset

#### B. `generateImagesForProject(projectId)`
- **Purpose:** Generates images without streaming
- **Use Case:** Background processing or simple batch generation
- **Features:**
  - Same core logic as streaming version
  - No progress callbacks

### 2. Asset Selection Logic

```typescript
// Only processes assets that meet ALL these criteria:
- project_id matches the target project
- selected_for_processing = true (user selected this asset)
- image_generated = false (image not yet generated)
```

**Key Points:**
- Only **selected** assets are processed (not all assets)
- Skips assets that already have generated images
- Checks for completion before starting generation

### 3. Image Generation Process

For each selected asset that needs an image:

1. **Extract Description:**
   ```typescript
   const imageDescription = asset.appearance || asset.description || asset.name;
   ```
   - Priority order: `appearance` → `description` → `name`
   - The `appearance` field contains AI-generated detailed visual descriptions

2. **Call Generation Method:**
   ```typescript
   const imageUrl = await this.generateImage(imageDescription);
   ```

3. **Update Database:**
   ```typescript
   await supabase
     .from("assets")
     .update({
       image_url: imageUrl,
       image_generated: true,
     })
     .eq("id", asset.id);
   ```

4. **Rate Limiting:**
   - 1 second delay between each asset generation to avoid API rate limits

## The Image Generation Prompt

### Model Used
- **Model:** `gemini-2.5-flash-image`
- **Provider:** Google Generative AI

### Complete Prompt Template

```text
Generate a realistic, professional product image based on this exact description: "{description}"

CRITICAL REQUIREMENTS:
- The asset must be isolated on a pure white background (RGB: 255, 255, 255) with no shadows, gradients, or background elements
- The asset should be clearly visible and identifiable exactly as described in the appearance description
- Professional product photography style, similar to e-commerce product images with clean, isolated presentation
- High quality, detailed, and accurate representation matching the description precisely
- The image should be suitable for factory planning documentation and technical specifications
- Ensure every detail mentioned in the description is accurately represented in the image
- The asset must appear exactly as it would in real life based on the provided appearance description
```

### Prompt Breakdown

1. **Base Instruction:**
   - Uses the asset's appearance description as the primary input
   - Requests a "realistic, professional product image"

2. **Critical Requirements:**
   - **White Background:** Pure white (RGB: 255, 255, 255) with no shadows or gradients
   - **Visibility:** Asset must be clearly visible and identifiable
   - **Style:** E-commerce product photography style (clean, isolated)
   - **Quality:** High quality, detailed, accurate
   - **Use Case:** Suitable for factory planning documentation
   - **Accuracy:** Every detail from description must be represented
   - **Realism:** Must appear as it would in real life

### Why These Requirements?

- **White Background:** Essential for clean presentation in technical documentation and easy asset isolation
- **E-commerce Style:** Professional, standardized appearance suitable for business documentation
- **Detail Accuracy:** Ensures generated images match the AI-generated appearance descriptions from the planning phase
- **Technical Suitability:** Images are used in factory planning layouts and reports

## Response Processing

### Expected Response Structure

```typescript
response.candidates[0].content.parts[].inlineData
```

### Processing Logic

1. **Extract Candidates:**
   ```typescript
   const candidates = response.candidates;
   ```

2. **Get First Candidate:**
   ```typescript
   const candidate = candidates[0];
   const parts = candidate.content.parts;
   ```

3. **Find Image Data:**
   - Looks for `inlineData` in parts (base64 encoded image)
   - Falls back to checking for URLs in text parts
   - Returns as data URL: `data:image/png;base64,{base64Data}`

4. **Fallback Handling:**
   - If unexpected format: Returns placeholder URL
   - If error occurs: Returns placeholder URL
   - Placeholder format: `https://via.placeholder.com/400x300?text={description}`

## Error Handling

### Per-Asset Errors
- If one asset fails, generation continues with remaining assets
- Errors are logged but don't stop the entire process
- Failed assets remain with `image_generated = false`

### Global Errors
- Database connection errors stop the process
- API authentication errors stop the process
- Project lock prevents duplicate concurrent executions

## Duplicate Prevention

The service uses a `Set<string>` to track projects currently generating:

```typescript
private generatingProjects = new Set<string>();

// Before starting:
if (this.generatingProjects.has(projectId)) {
  return; // Skip duplicate call
}

// After completion:
this.generatingProjects.delete(projectId);
```

## Database Schema

### Assets Table Fields Used

- `id`: Asset unique identifier
- `project_id`: Links asset to project
- `name`: Asset name (fallback for description)
- `description`: Asset description (secondary fallback)
- `appearance`: **Primary source** - AI-generated detailed visual description
- `image_url`: Generated image URL (data URL or storage URL)
- `image_generated`: Boolean flag indicating if image was generated
- `selected_for_processing`: Boolean flag indicating user selection

## Integration Points

### 1. Planning Service
- Generates `appearance` field with detailed descriptions
- Located in: `backend/src/services/ai/prompts/eliteSystemPrompts.ts`
- The appearance description is specifically designed for image generation

### 2. Step Orchestrator
- Triggers image generation as part of workflow
- Step name: `"assetsImagesGenerating"`
- Located in: `backend/src/services/stepOrchestrator.ts`

### 3. API Routes
- Streaming endpoint: `backend/src/routes/stream.ts`
- Data endpoint: `backend/src/routes/data.ts`

## Example Flow

1. **Planning Phase:**
   - AI generates asset with `appearance: "Large industrial CNC milling machine, metallic gray finish, 3m x 2m x 2.5m dimensions, control panel on front, multiple tool heads visible"`

2. **User Selection:**
   - User selects assets they want images for
   - `selected_for_processing = true` set in database

3. **Image Generation Trigger:**
   - Step orchestrator calls `generateImagesForProjectWithStream()`
   - Service finds selected assets with `image_generated = false`

4. **Generation:**
   - For each asset:
     - Extracts `appearance` description
     - Builds prompt with white background requirements
     - Calls Gemini 2.5 Flash Image model
     - Receives base64 image data
     - Converts to data URL
     - Updates database with `image_url` and `image_generated = true`

5. **Completion:**
   - All selected assets have images
   - Step orchestrator moves to next step (sourcing)

## Key Code References

### Main Generation Method
```365:428:backend/src/services/imageGeneration.ts
  private async generateImage(description: string): Promise<string> {
    try {
      // Use Gemini 2.5 Flash Image model for image generation
      const model = this.genAI.getGenerativeModel({
        model: "models/gemini-2.5-flash-image",
      });

      // Create a prompt for image generation with white background requirement
      // The description parameter contains the AI-generated appearance description
      const prompt = `Generate a realistic, professional product image based on this exact description: "${description}"

CRITICAL REQUIREMENTS:
- The asset must be isolated on a pure white background (RGB: 255, 255, 255) with no shadows, gradients, or background elements
- The asset should be clearly visible and identifiable exactly as described in the appearance description
- Professional product photography style, similar to e-commerce product images with clean, isolated presentation
- High quality, detailed, and accurate representation matching the description precisely
- The image should be suitable for factory planning documentation and technical specifications
- Ensure every detail mentioned in the description is accurately represented in the image
- The asset must appear exactly as it would in real life based on the provided appearance description`;

      // Generate content (image)
      const result = await model.generateContent(prompt);
      const response = result.response;

      // Extract image data from response
      // The response structure: response.candidates[0].content.parts[].inlineData
      const candidates = response.candidates;
      
      if (candidates && candidates.length > 0) {
        const candidate = candidates[0];
        const content = candidate.content;
        const parts = content.parts;

        if (parts && parts.length > 0) {
          // Look for image data in the parts
          for (const part of parts) {
            // Check if this part contains inline image data
            if ("inlineData" in part && part.inlineData) {
              const imageData = part.inlineData.data;
              const mimeType = part.inlineData.mimeType || "image/png";
              // Return as data URL for direct use in img tags
              return `data:${mimeType};base64,${imageData}`;
            }
            // Some models might return text with URLs
            if ("text" in part && part.text) {
              const urlMatch = part.text.match(/https?:\/\/[^\s]+/);
              if (urlMatch) {
                return urlMatch[0];
              }
            }
          }
        }
      }

      // Fallback: If image generation doesn't return expected format,
      // return a placeholder
      logger.warn("Image generation returned unexpected format, using placeholder", { descriptionLength: description.length });
      return `https://via.placeholder.com/400x300?text=${encodeURIComponent(description.substring(0, 50))}`;
    } catch (error: any) {
      logger.error("Error generating image with Gemini", error, { descriptionLength: description.length });
      // Fallback to placeholder on error
      return `https://via.placeholder.com/400x300?text=${encodeURIComponent(description.substring(0, 50))}`;
    }
  }
```

### Description Extraction
```125:128:backend/src/services/imageGeneration.ts
          // Generate image using Gemini 2.5 Flash Image model
          // Prioritize appearance field which contains AI-generated detailed description
          const imageDescription = asset.appearance || asset.description || asset.name;
          const imageUrl = await this.generateImage(imageDescription);
```

## Configuration

### Environment Variables
- `GEMINI_API_KEY`: Required API key for Google Generative AI

### Model Configuration
- Model: `models/gemini-2.5-flash-image`
- Rate Limiting: 1 second delay between requests

## Summary

The asset image generation system:
1. **Uses** Gemini 2.5 Flash Image model
2. **Takes** appearance descriptions from planning phase
3. **Generates** professional product images with white backgrounds
4. **Stores** images as data URLs in the database
5. **Processes** only user-selected assets
6. **Handles** errors gracefully with fallbacks
7. **Prevents** duplicate concurrent executions

The prompt is specifically designed to produce clean, professional, isolated product images suitable for factory planning documentation and technical specifications.

