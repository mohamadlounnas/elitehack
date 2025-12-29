/**
 * DXF Converter Service
 * Converts floor plan images to DXF format (which can be opened in AutoCAD and saved as DWG)
 */

import fs from "fs";
import path from "path";
import axios from "axios";
import { logger } from "../utils/logger.js";
import { Buffer } from "buffer";
import { createWriteStream } from "fs";
import archiver from "archiver";
import { promisify } from "util";

/**
 * Convert a floor plan image to DXF format
 * The image is embedded as a raster image reference in the DXF file
 */
export async function convertImageToDXF(
  imageUrl: string,
  outputPath: string,
  imageName: string = "FloorPlan"
): Promise<void> {
  try {
    logger.info("Converting image to DXF", { imageUrl, outputPath });

    // Download the image
    let imageBuffer: Buffer;
    let imageWidth = 1000; // Default dimensions
    let imageHeight = 1000;

    if (imageUrl.startsWith("data:")) {
      // Handle data URL
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      // Download from URL
      const response = await axios.get(imageUrl, {
        responseType: "arraybuffer",
      });
      imageBuffer = Buffer.from(response.data);
      
      // Try to get image dimensions (basic PNG header parsing)
      if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
        // PNG format
        imageWidth = imageBuffer.readUInt32BE(16);
        imageHeight = imageBuffer.readUInt32BE(20);
      }
    } else {
      // Local file path
      if (fs.existsSync(imageUrl)) {
        imageBuffer = fs.readFileSync(imageUrl);
        // Try to get dimensions
        if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
          imageWidth = imageBuffer.readUInt32BE(16);
          imageHeight = imageBuffer.readUInt32BE(20);
        }
      } else {
        throw new Error(`Image file not found: ${imageUrl}`);
      }
    }

    // Save image to a temporary location (DXF will reference it)
    const tempDir = path.dirname(outputPath);
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const imageFilename = `${imageName}_${Date.now()}.png`;
    const imagePath = path.join(tempDir, imageFilename);
    await fs.promises.writeFile(imagePath, imageBuffer);

    // Generate DXF file content
    const dxfContent = generateDXFWithImage(imagePath, imageName, imageWidth, imageHeight);

    // Write DXF file
    await fs.promises.writeFile(outputPath, dxfContent, "utf-8");

    logger.info("DXF file created successfully", { outputPath, imagePath });
  } catch (error: any) {
    logger.error("Error converting image to DXF", error);
    throw error;
  }
}

/**
 * Generate DXF file content with embedded image
 */
function generateDXFWithImage(
  imagePath: string,
  imageName: string,
  width: number,
  height: number
): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, "").split(".")[0];

  // DXF file structure
  const dxf = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1015", // AutoCAD 2000 format
    "9",
    "$HANDSEED",
    "5",
    "FFFF",
    "0",
    "ENDSEC",
    
    // TABLES section
    "0",
    "SECTION",
    "2",
    "TABLES",
    
    // Layer table
    "0",
    "TABLE",
    "2",
    "LAYER",
    "5",
    "2",
    "100",
    "AcDbSymbolTable",
    "70",
    "1",
    "0",
    "LAYER",
    "5",
    "10",
    "100",
    "AcDbSymbolTableRecord",
    "100",
    "AcDbLayerTableRecord",
    "2",
    "0",
    "70",
    "0",
    "62",
    "7",
    "6",
    "CONTINUOUS",
    "0",
    "ENDTAB",
    
    // Image definition table
    "0",
    "TABLE",
    "2",
    "IMAGEDEF",
    "5",
    "3",
    "100",
    "AcDbSymbolTable",
    "70",
    "1",
    "0",
    "IMAGEDEF",
    "5",
    "11",
    "100",
    "AcDbSymbolTableRecord",
    "100",
    "AcDbRasterImageDef",
    "1",
    imagePath, // Image file path
    "10",
    width.toString(), // Image width in pixels
    "20",
    height.toString(), // Image height in pixels
    "11",
    "1.0", // Default size units
    "21",
    "1.0",
    "0",
    "ENDTAB",
    
    "0",
    "ENDSEC",
    
    // ENTITIES section
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    
    // Insert image as IMAGE entity
    "0",
    "IMAGE",
    "5",
    "100",
    "100",
    "AcDbEntity",
    "8",
    "0", // Layer
    "100",
    "AcDbRasterImage",
    "90",
    "0", // Class version
    "10",
    "0.0", // Insertion point X
    "20",
    "0.0", // Insertion point Y
    "30",
    "0.0", // Insertion point Z
    "11",
    width.toString(), // U vector X
    "21",
    "0.0", // U vector Y
    "31",
    "0.0", // U vector Z
    "12",
    "0.0", // V vector X
    "22",
    height.toString(), // V vector Y
    "32",
    "0.0", // V vector Z
    "13",
    width.toString(), // Image size X
    "23",
    height.toString(), // Image size Y
    "340",
    "11", // Image definition handle
    "70",
    "15", // Image display flags (show image)
    "280",
    "50", // Clipping state (0 = off)
    "281",
    "50", // Brightness (0-100)
    "282",
    "50", // Contrast (0-100)
    "283",
    "50", // Fade (0-100)
    "360",
    "0", // Image definition reactor handle
    
    "0",
    "ENDSEC",
    
    // EOF
    "0",
    "EOF"
  ].join("\n");

  return dxf;
}

/**
 * Create a DXF file with embedded image reference
 * Returns both DXF content and image buffer for ZIP packaging
 */
export async function createSimpleDXFWithImage(
  imageUrl: string,
  outputPath: string
): Promise<{ dxfContent: string; imageBuffer: Buffer; imagePath: string }> {
  try {
    // Download image
    let imageBuffer: Buffer;
    if (imageUrl.startsWith("data:")) {
      const base64Data = imageUrl.split(",")[1];
      imageBuffer = Buffer.from(base64Data, "base64");
    } else if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
      const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
      imageBuffer = Buffer.from(response.data);
    } else {
      imageBuffer = fs.readFileSync(imageUrl);
    }

    // Get image dimensions (basic PNG parsing)
    let width = 1000;
    let height = 1000;
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
      // PNG
      width = imageBuffer.readUInt32BE(16);
      height = imageBuffer.readUInt32BE(20);
    }

    // Save image next to DXF file (for reference in DXF)
    const imagePath = outputPath.replace(".dxf", ".png");
    await fs.promises.writeFile(imagePath, imageBuffer);

    // Create DXF with image reference
    // Use relative path so it works when both files are in the same directory
    const imageFilename = path.basename(imagePath);
    const dxfContent = generateDXFWithImageReference(imageFilename, width, height);

    await fs.promises.writeFile(outputPath, dxfContent, "utf-8");
    logger.info("DXF with image reference created", { outputPath, imagePath });
    
    return { dxfContent, imageBuffer, imagePath };
  } catch (error: any) {
    logger.error("Error creating DXF with image", error);
    throw error;
  }
}

/**
 * Create a ZIP file containing both DXF and PNG image
 */
export async function createDXFZip(
  imageUrl: string,
  outputZipPath: string
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const tempDir = path.dirname(outputZipPath);
      const dxfPath = outputZipPath.replace(".zip", ".dxf");
      
      // Create DXF and get image buffer
      const { imageBuffer, imagePath } = await createSimpleDXFWithImage(imageUrl, dxfPath);
      
      // Create ZIP file
      const output = createWriteStream(outputZipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      output.on("close", () => {
        logger.info("DXF ZIP created", { 
          zipPath: outputZipPath,
          size: archive.pointer() 
        });
        
        // Clean up temp files
        setTimeout(() => {
          fs.unlink(dxfPath, () => {});
          fs.unlink(imagePath, () => {});
        }, 1000);
        
        resolve();
      });
      
      archive.on("error", (err) => {
        logger.error("Error creating ZIP", err);
        reject(err);
      });
      
      archive.pipe(output);
      
      // Add DXF file
      archive.file(dxfPath, { name: path.basename(dxfPath) });
      
      // Add PNG image with same name as referenced in DXF
      archive.append(imageBuffer, { name: path.basename(imagePath) });
      
      // Add README file with instructions
      const readmeContent = `FLOOR PLAN DWG FILES
========================

This ZIP file contains:
1. ${path.basename(dxfPath)} - The DXF file (AutoCAD format)
2. ${path.basename(imagePath)} - The floor plan image (PNG)

INSTRUCTIONS:
1. Extract all files from this ZIP to the same folder
2. Open the DXF file in AutoCAD or any CAD software
3. The floor plan image should appear in the drawing
4. You can save the DXF file as DWG format in AutoCAD

NOTE: Keep both files in the same folder. The DXF file references the PNG image, so both files must be in the same location for the image to display correctly.
`;
      archive.append(readmeContent, { name: "README.txt" });
      
      await archive.finalize();
    } catch (error: any) {
      logger.error("Error creating DXF ZIP", error);
      reject(error);
    }
  });
}

/**
 * Generate DXF content with image reference
 */
function generateDXFWithImageReference(
  imagePath: string,
  width: number,
  height: number
): string {
  // Use just the filename (relative path) so it works when both files are in same directory
  const imageFilename = path.basename(imagePath);
  
  const lines = [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "9",
    "$ACADVER",
    "1",
    "AC1015",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "TABLES",
    "0",
    "TABLE",
    "2",
    "LAYER",
    "5",
    "2",
    "100",
    "AcDbSymbolTable",
    "70",
    "1",
    "0",
    "LAYER",
    "5",
    "10",
    "100",
    "AcDbSymbolTableRecord",
    "100",
    "AcDbLayerTableRecord",
    "2",
    "0",
    "70",
    "0",
    "62",
    "7",
    "6",
    "CONTINUOUS",
    "0",
    "ENDTAB",
    "0",
    "TABLE",
    "2",
    "IMAGEDEF",
    "5",
    "3",
    "100",
    "AcDbSymbolTable",
    "70",
    "1",
    "0",
    "IMAGEDEF",
    "5",
    "11",
    "100",
    "AcDbSymbolTableRecord",
    "100",
    "AcDbRasterImageDef",
    "1",
    imageFilename,
    "10",
    width.toString(),
    "20",
    height.toString(),
    "11",
    "1.0",
    "21",
    "1.0",
    "0",
    "ENDTAB",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    "0",
    "IMAGE",
    "5",
    "100",
    "100",
    "AcDbEntity",
    "8",
    "0",
    "100",
    "AcDbRasterImage",
    "90",
    "0",
    "10",
    "0.0",
    "20",
    "0.0",
    "30",
    "0.0",
    "11",
    width.toString(),
    "21",
    "0.0",
    "31",
    "0.0",
    "12",
    "0.0",
    "22",
    height.toString(),
    "32",
    "0.0",
    "13",
    width.toString(),
    "23",
    height.toString(),
    "340",
    "11",
    "70",
    "15",
    "280",
    "0",
    "281",
    "50",
    "282",
    "50",
    "283",
    "50",
    "0",
    "ENDSEC",
    "0",
    "EOF"
  ];

  return lines.join("\n");
}

