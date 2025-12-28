import { createLLM } from "../../utils/langchain.js";
import { supabase } from "../../utils/supabase.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { stepOrchestrator } from "../stepOrchestrator.js";
import { logger } from "../../utils/logger.js";
import { ELITE_PLANNING_PROMPT, ALGERIA_COMPLIANCE_RULES } from "./prompts/eliteSystemPrompts.js";

type PlanningStreamCallback = (update: {
  type: "thinking" | "analyzing" | "generating" | "complete";
  content: string;
  progress: number;
}) => void;

// Track running planning processes to prevent double execution
const runningPlanning = new Set<string>();

/**
 * Enhanced Planning Data Structure - Comprehensive Industrial Dossier
 */
export interface ElitePlanningData {
  executive_summary?: {
    factory_identity: string;
    strategic_positioning: string;
    industry_positioning: string;
    economic_relevance: string;
    key_highlights: string[];
  };
  
  industrial_identity?: {
    factory_name: string;
    industrial_category: string;
    legal_nature: string;
    operating_scope: "national" | "export" | "regional";
    industry_ambition: string;
    certifications_required: string[];
  };
  
  location_justification?: {
    recommended_region: string;
    industrial_zone_type: string;
    land_requirements: {
      total_area_sqm: number;
      built_area_sqm: number;
      expansion_reserve_sqm: number;
    };
    logistics_access: {
      nearest_port: string;
      highway_access: string;
      railway_access: string;
      supplier_proximity: string;
    };
    site_justification: string;
  };
  
  factory_dimensions?: {
    width: number;
    length: number;
    height: number;
    floors: number;
    total_area_sqm?: number;
    production_area_sqm?: number;
    storage_area_sqm?: number;
    office_area_sqm?: number;
    utility_area_sqm?: number;
  };
  
  production_lines?: Array<{
    line_name: string;
    function: string;
    role_in_chain: string;
    industrial_importance: string;
    process_logic: string;
    capacity: string;
    equipment_requirements: string[];
  }>;
  
  factory_engineering?: {
    zoning_concept: {
      description: string;
      zones: Array<{
        zone_name: string;
        purpose: string;
        area_sqm: number;
        special_requirements: string;
      }>;
    };
    material_flow: {
      raw_material_intake: string;
      production_flow: string;
      finished_goods_output: string;
    };
    quality_control: {
      qa_points: string[];
      testing_facilities: string;
    };
    safety_compliance: {
      safety_zones: string[];
      emergency_systems: string[];
      atex_requirements: string;
    };
    control_management: {
      control_room: string;
      scada_requirements: string;
      mes_integration: string;
    };
  };
  
  assets?: Array<{
    name: string;
    type: string;
    production_line?: string;
    appearance: string;
    description: string;
    specifications?: {
      power_kw?: number;
      dimensions?: string;
      weight_kg?: number;
      capacity?: string;
    };
    estimated_cost_usd?: number;
    supplier_preferences?: string[];
  }>;
  
  production_process?: string;
  machinery?: string[];
  materials?: string[];
  capacity?: string;
  
  digital_transformation?: {
    monitoring_scope: string;
    predictive_maintenance: string;
    energy_optimization: string;
    production_optimization: string;
    quality_intelligence: string;
    business_intelligence: string;
    cybersecurity: string;
  };
  
  risk_assessment?: {
    market_risks: string[];
    technical_risks: string[];
    supply_risks: string[];
    operational_risks: string[];
    mitigation_strategies: string[];
  };
  
  scalability?: {
    expansion_phases: string[];
    product_diversification: string[];
    capacity_growth: string;
    technology_upgrades: string[];
  };
}

class PlanningService {
  /**
   * Start planning with streaming updates - Elite Version
   */
  async startPlanningWithStream(
    projectId: string,
    onUpdate: PlanningStreamCallback
  ): Promise<void> {
    // Check if planning is already running
    if (runningPlanning.has(projectId)) {
      console.log(`Planning already running for project ${projectId}`);
      return;
    }

    runningPlanning.add(projectId);
    try {
      onUpdate({ type: "thinking", content: "Elite Industrial AI: Gathering project requirements...", progress: 5 });

      // Get all messages and files for context
      const { data: messages } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const { data: files } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", projectId);

      // Extract requirements from messages
      const userRequirements = messages
        ?.filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n") || "";

      onUpdate({
        type: "analyzing",
        content: "Analyzing requirements with industrial engineering expertise...",
        progress: 15,
      });

      const llm = createLLM();

      // Build the elite prompt with structured output requirements
      const systemPrompt = ELITE_PLANNING_PROMPT;

      onUpdate({
        type: "generating",
        content: "Generating comprehensive factory plan for Algerian market...",
        progress: 25,
      });

      // Stream the response
      let fullContent = "";
      const stream = await llm.stream([
        new SystemMessage(systemPrompt),
        new HumanMessage(`USER REQUIREMENTS:\n${userRequirements}\n\nGenerate a comprehensive industrial project plan in JSON format as specified.`),
      ]);

      let progressStep = 25;
      for await (const chunk of stream) {
        const chunkContent = chunk.content as string;
        fullContent += chunkContent;
        
        // Update progress based on content length
        progressStep = Math.min(85, 25 + (fullContent.length / 5000) * 60);
        
        onUpdate({
          type: "generating",
          content: "Building comprehensive industrial dossier...",
          progress: progressStep,
        });
      }

      onUpdate({
        type: "complete",
        content: "Finalizing elite project structure...",
        progress: 90,
      });

      let planningData: ElitePlanningData;
      try {
        // Try to extract JSON from response
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planningData = JSON.parse(jsonMatch[0]);
        } else {
          planningData = JSON.parse(fullContent);
        }
        
        // Validate and enhance the planning data
        planningData = this.validateAndEnhancePlanningData(planningData);
        
      } catch (parseError) {
        console.error("Error parsing planning data:", parseError);
        logger.error("Error parsing elite planning data", parseError as Error, { projectId });
        
        // Create a fallback structure
        planningData = this.createFallbackPlanningData();
      }

      // Save planning data to project (step transition handled by stepOrchestrator)
      await supabase
        .from("projects")
        .update({
          planning_data: planningData,
        })
        .eq("id", projectId);

      // Create assets in database
      if (planningData.assets && Array.isArray(planningData.assets)) {
        logger.info("Creating assets in database", { 
          projectId, 
          assetCount: planningData.assets.length 
        });
        
        for (const asset of planningData.assets) {
          logger.db("INSERT", "assets", { projectId, assetName: asset.name });
          const { error: insertError } = await supabase.from("assets").insert({
            project_id: projectId,
            name: asset.name,
            type: asset.type,
            appearance: asset.appearance,
            description: asset.description,
            specifications: asset.specifications || {},
            image_generated: false,
          });
          if (insertError) {
            logger.error("Error inserting asset", insertError, { 
              projectId, 
              assetName: asset.name 
            });
          }
        }
        logger.info("Assets created successfully", { 
          projectId, 
          assetCount: planningData.assets.length 
        });
      } else {
        logger.warn("No assets found in planning data to create", { 
          projectId,
          hasAssets: !!planningData.assets,
          assetsType: typeof planningData.assets
        });
      }

      onUpdate({
        type: "complete",
        content: "Elite industrial planning complete! Comprehensive dossier generated.",
        progress: 100,
      });

    } catch (error: any) {
      console.error("Error in planningService.startPlanningWithStream:", error);
      logger.error("Error in elite planning", error, { projectId });
      
      // Update project step to indicate error
      await supabase
        .from("projects")
        .update({ current_step: "planning" })
        .eq("id", projectId);
      throw error;
    } finally {
      runningPlanning.delete(projectId);
    }
  }

  async startPlanning(projectId: string): Promise<void> {
    // Check if planning is already running (e.g., via streaming)
    if (runningPlanning.has(projectId)) {
      console.log(`Planning already running for project ${projectId}`);
      return;
    }

    runningPlanning.add(projectId);
    try {
      // Get all messages and files for context
      const { data: messages } = await supabase
        .from("project_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      const { data: files } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", projectId);

      // Extract requirements from messages
      const userRequirements = messages
        ?.filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n") || "";

      const llm = createLLM();
      const systemPrompt = ELITE_PLANNING_PROMPT;

      const response = await llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(`USER REQUIREMENTS:\n${userRequirements}\n\nGenerate a comprehensive industrial project plan in JSON format as specified.`),
      ]);

      let planningData: ElitePlanningData;
      try {
        const content = response.content as string;
        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          planningData = JSON.parse(jsonMatch[0]);
        } else {
          planningData = JSON.parse(content);
        }
        
        // Validate and enhance the planning data
        planningData = this.validateAndEnhancePlanningData(planningData);
        
      } catch (parseError) {
        console.error("Error parsing planning data:", parseError);
        logger.error("Error parsing elite planning data (non-streaming)", parseError as Error, { projectId });
        planningData = this.createFallbackPlanningData();
      }

      // Save planning data to project (step transition handled by stepOrchestrator)
      await supabase
        .from("projects")
        .update({
          planning_data: planningData,
        })
        .eq("id", projectId);

      // Create assets in database
      if (planningData.assets && Array.isArray(planningData.assets)) {
        logger.info("Creating assets in database (non-streaming)", { 
          projectId, 
          assetCount: planningData.assets.length 
        });
        for (const asset of planningData.assets) {
          logger.db("INSERT", "assets", { projectId, assetName: asset.name });
          const { error: insertError } = await supabase.from("assets").insert({
            project_id: projectId,
            name: asset.name,
            type: asset.type,
            appearance: asset.appearance,
            description: asset.description,
            specifications: asset.specifications || {},
            image_generated: false,
          });
          if (insertError) {
            logger.error("Error inserting asset", insertError, { 
              projectId, 
              assetName: asset.name 
            });
          }
        }
        logger.info("Assets created successfully (non-streaming)", { 
          projectId, 
          assetCount: planningData.assets.length 
        });
      } else {
        logger.warn("No assets found in planning data to create (non-streaming)", { 
          projectId,
          hasAssets: !!planningData.assets,
          assetsType: typeof planningData.assets
        });
      }

    } catch (error: any) {
      console.error("Error in planningService.startPlanning:", error);
      logger.error("Error in elite planning (non-streaming)", error, { projectId });
      
      // Update project step to indicate error
      await supabase
        .from("projects")
        .update({ current_step: "planning" })
        .eq("id", projectId);
      throw error;
    } finally {
      runningPlanning.delete(projectId);
    }
  }

  /**
   * Validate and enhance planning data with defaults
   */
  private validateAndEnhancePlanningData(data: ElitePlanningData): ElitePlanningData {
    // Ensure factory_dimensions exists with defaults
    if (!data.factory_dimensions) {
      data.factory_dimensions = {
        width: 50,
        length: 100,
        height: 8,
        floors: 1,
      };
    }
    
    // Calculate total area if not present
    if (!data.factory_dimensions.total_area_sqm) {
      data.factory_dimensions.total_area_sqm = 
        data.factory_dimensions.width * data.factory_dimensions.length;
    }
    
    // Ensure production_process exists
    if (!data.production_process) {
      data.production_process = "General Manufacturing";
    }
    
    // Ensure assets array exists
    if (!data.assets) {
      data.assets = [];
    }
    
    // Enhance each asset with defaults
    data.assets = data.assets.map(asset => ({
      ...asset,
      appearance: asset.appearance || `Industrial ${asset.type || 'equipment'} - standard appearance`,
      description: asset.description || `${asset.name} for ${data.production_process}`,
      specifications: asset.specifications || {},
    }));
    
    // Determine factory scale based on total area
    const totalArea = data.factory_dimensions.total_area_sqm || 5000;
    let factoryScale: 'small' | 'medium' | 'large' | 'mega' = 'medium';
    let minAssets = 15;
    
    if (totalArea < 2000) {
      factoryScale = 'small';
      minAssets = 8;
    } else if (totalArea < 10000) {
      factoryScale = 'medium';
      minAssets = 15;
    } else if (totalArea < 50000) {
      factoryScale = 'large';
      minAssets = 25;
    } else {
      factoryScale = 'mega';
      minAssets = 40;
    }
    
    // Log warning if assets count is below minimum for scale
    if (data.assets.length < minAssets) {
      logger.warn(`Insufficient assets for ${factoryScale} factory. Expected at least ${minAssets}, got ${data.assets.length}. Adding default equipment.`, {
        factoryScale,
        totalArea,
        currentAssets: data.assets.length,
        minAssets
      });
      
      // Add default industrial equipment to reach minimum
      const defaultEquipment = this.generateDefaultEquipment(data, minAssets - data.assets.length);
      data.assets = [...data.assets, ...defaultEquipment];
    }
    
    // Ensure executive_summary exists
    if (!data.executive_summary) {
      data.executive_summary = {
        factory_identity: data.industrial_identity?.factory_name || "Industrial Facility",
        strategic_positioning: "Strategic industrial manufacturing",
        industry_positioning: "Industry 4.0 ready facility",
        economic_relevance: "Contributing to local economic development",
        key_highlights: [
          "Modern manufacturing facility",
          "Compliant with Algerian regulations",
          "Export-oriented production capability"
        ]
      };
    }
    
    // Ensure industrial_identity exists
    if (!data.industrial_identity) {
      data.industrial_identity = {
        factory_name: "Industrial Manufacturing Facility",
        industrial_category: "General Manufacturing",
        legal_nature: "SARL",
        operating_scope: "national",
        industry_ambition: "Industry 4.0 compliant manufacturing",
        certifications_required: ["ISO 9001", "CE Marking"]
      };
    }
    
    // Ensure risk_assessment exists
    if (!data.risk_assessment) {
      data.risk_assessment = {
        market_risks: ["Market demand fluctuations", "Competition pressure"],
        technical_risks: ["Equipment maintenance", "Technology obsolescence"],
        supply_risks: ["Raw material availability", "Supplier reliability"],
        operational_risks: ["Labor availability", "Utility reliability"],
        mitigation_strategies: [
          "Diversify supplier base",
          "Implement preventive maintenance",
          "Build strategic inventory reserves"
        ]
      };
    }
    
    // Ensure scalability exists
    if (!data.scalability) {
      data.scalability = {
        expansion_phases: ["Phase 1: Current capacity", "Phase 2: 50% expansion", "Phase 3: Export market entry"],
        product_diversification: ["Current product line", "Adjacent product opportunities"],
        capacity_growth: "100% expansion potential within existing land",
        technology_upgrades: ["IoT integration", "AI-powered quality control", "Automated logistics"]
      };
    }
    
    return data;
  }

  /**
   * Generate default industrial equipment to fill gaps
   */
  private generateDefaultEquipment(data: ElitePlanningData, count: number): NonNullable<typeof data.assets> {
    const category = data.industrial_identity?.industrial_category || "General Manufacturing";
    const processType = data.production_process || "Manufacturing";
    
    const defaultEquipmentPool = [
      // Production Equipment
      { name: "Industrial CNC Machining Center", type: "Production Machine", appearance: "Large industrial CNC machine with enclosed work area, grey metallic body with blue control panel, touchscreen interface, automatic tool changer visible on side", description: "High-precision CNC machining center for complex part manufacturing" },
      { name: "Hydraulic Press System", type: "Production Machine", appearance: "Heavy-duty hydraulic press with green steel frame, digital pressure gauge, safety light curtains on sides, pneumatic controls visible", description: "Industrial hydraulic press for forming and stamping operations" },
      { name: "Industrial Robotic Welding Cell", type: "Production Machine", appearance: "Yellow robotic arm in enclosed safety cell, welding torch attached, spark shields visible, orange warning lights, protective curtains", description: "Automated welding system for consistent high-quality welds" },
      { name: "Automated Assembly Line Station", type: "Production Machine", appearance: "Modular assembly station with conveyor belt, multiple tool holders, integrated lighting, touchscreen HMI panel, blue and grey color scheme", description: "Flexible assembly station with automated material handling" },
      { name: "Industrial Laser Cutting Machine", type: "Production Machine", appearance: "Enclosed laser cutting system with ventilation hood, orange safety enclosure, visible beam path, touchscreen control station on side", description: "High-power laser cutting for precision sheet metal work" },
      { name: "Injection Molding Machine", type: "Production Machine", appearance: "Large injection molding press with horizontal clamping unit, blue and white body, hopper on top, hydraulic systems visible", description: "Plastic injection molding for component manufacturing" },
      
      // Material Handling
      { name: "Electric Forklift EF-3000", type: "Material Handling", appearance: "Yellow electric forklift with overhead guard, counter-balanced design, LED headlights, ergonomic operator compartment, lithium battery pack", description: "3-ton capacity electric forklift for warehouse operations" },
      { name: "Automated Guided Vehicle (AGV)", type: "Material Handling", appearance: "Low-profile AGV platform with blue body, laser sensors on corners, flashing yellow safety lights, roller conveyor on top for pallets", description: "Autonomous material transport vehicle with navigation sensors" },
      { name: "Overhead Bridge Crane - 10T", type: "Material Handling", appearance: "Yellow double-girder overhead crane spanning warehouse width, electric hoist at center, pendant control hanging down, warning stripes on girders", description: "10-ton capacity overhead crane for heavy lifting" },
      { name: "Roller Conveyor System", type: "Material Handling", appearance: "Industrial roller conveyor with powered rollers, steel frame in grey, safety guards on sides, diverter sections with photoeyes visible", description: "Powered conveyor system for continuous material flow" },
      { name: "Pallet Stacker - Automated", type: "Material Handling", appearance: "Tall automated pallet stacker with telescopic forks, sensor array at front, blue body with safety lights, enclosed operator station", description: "High-reach pallet stacker for vertical storage operations" },
      
      // Quality Control
      { name: "Coordinate Measuring Machine (CMM)", type: "Quality Control", appearance: "Precision CMM with granite surface plate, motorized bridge design, ruby probe visible, computer workstation attached, climate control enclosure", description: "High-accuracy dimensional measurement system" },
      { name: "Vision Inspection System", type: "Quality Control", appearance: "Enclosed inspection station with high-resolution cameras, LED ring lights, conveyor pass-through, monitor displaying defect detection", description: "Automated visual quality inspection system" },
      { name: "Hardness Testing Machine", type: "Quality Control", appearance: "Desktop hardness tester with digital display, test specimen stage, diamond indenter visible, control buttons on front panel", description: "Material hardness testing equipment" },
      { name: "Spectral Analyzer", type: "Quality Control", appearance: "Benchtop spectral analysis unit with sample chamber, touchscreen interface, optical viewing port, stainless steel housing", description: "Material composition analysis system" },
      
      // Storage Systems
      { name: "Automated Storage and Retrieval System", type: "Storage", appearance: "Multi-level ASRS with metal racking reaching high ceiling, automated crane moving between aisles, blue bins visible in slots, control tower at end", description: "High-density automated storage system" },
      { name: "Heavy-Duty Pallet Racking", type: "Storage", appearance: "Orange steel pallet racking system with multiple levels, safety bars installed, load capacity labels visible, forklift accessible aisles", description: "Industrial pallet storage racking" },
      { name: "Raw Material Silos", type: "Storage", appearance: "Large cylindrical steel silo with conical bottom, access ladder on side, level indicators, dust collection system at top, grey exterior finish", description: "Bulk material storage silo" },
      
      // Utilities
      { name: "Industrial Air Compressor System", type: "Utilities", appearance: "Large screw compressor with blue housing, integrated dryer unit, air receiver tank beside it, pressure gauges and control panel visible", description: "Compressed air generation system" },
      { name: "Chiller Unit - 500kW", type: "Utilities", appearance: "Industrial chiller with cooling towers visible, green housing, large fans on top, piping connections on sides, control cabinet attached", description: "Process cooling water system" },
      { name: "Electric Transformer Station", type: "Utilities", appearance: "Enclosed transformer cabinet in grey, high voltage warning signs, ventilation grilles, incoming and outgoing cable trays visible", description: "Main electrical distribution transformer" },
      { name: "Industrial Boiler System", type: "Utilities", appearance: "Steam boiler with insulated cylindrical body, burner unit at front, control panel on side, exhaust stack, water treatment unit attached", description: "Steam generation for process heating" },
      { name: "Water Treatment Plant", type: "Utilities", appearance: "Multi-tank water treatment system with filtration columns, UV sterilizer unit, chemical dosing pumps, monitoring panels, stainless steel piping", description: "Industrial water purification system" },
      
      // Packaging
      { name: "Automatic Carton Sealer", type: "Packaging", appearance: "Inline carton sealer with top and bottom tape heads, adjustable side rails, conveyor integrated, orange safety guards, control panel at side", description: "Automated box sealing machine" },
      { name: "Stretch Wrapping Machine", type: "Packaging", appearance: "Rotating platform stretch wrapper with film carriage, turntable visible, safety fence around unit, film roll holder, control pedestal", description: "Pallet stretch wrapping system" },
      { name: "Industrial Label Applicator", type: "Packaging", appearance: "Print-and-apply label system with thermal printer, pneumatic applicator arm, sensor for product detection, label roll visible through cover", description: "Automated product labeling system" },
      
      // Safety Equipment
      { name: "Industrial Ventilation System", type: "Safety Equipment", appearance: "Large ductwork system with inline fans, air filtration units, damper controls, discharge hoods over work areas, vibration isolators", description: "Factory air quality management system" },
      { name: "Fire Suppression Panel", type: "Safety Equipment", appearance: "Red fire alarm control panel with zone indicators, key switches, LCD display, connection points for detectors, wall-mounted with glass door", description: "Integrated fire detection and suppression control" },
      { name: "Emergency Shower Station", type: "Safety Equipment", appearance: "Yellow emergency shower and eyewash station, pull handle visible, drain basin below, water supply pipes, green safety signs above", description: "Emergency safety shower and eyewash" },
      
      // Lab & Testing
      { name: "Material Testing Lab Unit", type: "Laboratory", appearance: "Enclosed tensile testing machine with load frame, hydraulic grips, extensometer attached to specimen, digital controller and PC workstation", description: "Mechanical property testing equipment" },
      { name: "Environmental Chamber", type: "Laboratory", appearance: "Walk-in environmental test chamber with viewing window, digital temperature/humidity display, heavy insulated door, shelving visible inside", description: "Climate simulation testing chamber" },
    ];
    
    // Select equipment based on category relevance and needed count
    const selectedEquipment: typeof data.assets = [];
    let poolIndex = 0;
    
    while (selectedEquipment.length < count && poolIndex < defaultEquipmentPool.length) {
      const equipment = defaultEquipmentPool[poolIndex];
      // Check if we don't already have this exact equipment
      if (!data.assets?.some(a => a.name === equipment.name)) {
        selectedEquipment.push({
          ...equipment,
          production_line: data.production_lines?.[0]?.line_name || "Main Production Line",
          estimated_cost_usd: 25000 + Math.floor(Math.random() * 200000),
          specifications: {
            power_kw: 15 + Math.floor(Math.random() * 100),
            dimensions: `${2 + Math.random() * 3}m x ${1 + Math.random() * 2}m x ${1.5 + Math.random() * 1.5}m`,
            weight_kg: 500 + Math.floor(Math.random() * 5000),
            capacity: "Standard industrial capacity"
          },
          supplier_preferences: ["Germany", "Italy", "China", "Turkey"]
        });
      }
      poolIndex++;
    }
    
    logger.info(`Added ${selectedEquipment.length} default equipment items to reach minimum asset count`);
    return selectedEquipment;
  }

  /**
   * Create fallback planning data if AI fails
   */
  private createFallbackPlanningData(): ElitePlanningData {
    return {
      executive_summary: {
        factory_identity: "Industrial Manufacturing Facility",
        strategic_positioning: "Strategic manufacturing investment in Algeria",
        industry_positioning: "Industry 4.0 ready facility",
        economic_relevance: "Contributing to Algerian industrial development",
        key_highlights: [
          "Modern manufacturing facility",
          "Compliant with Algerian regulations",
          "Sustainable production practices"
        ]
      },
      industrial_identity: {
        factory_name: "Industrial Manufacturing Facility",
        industrial_category: "General Manufacturing",
        legal_nature: "SARL",
        operating_scope: "national",
        industry_ambition: "Industry 4.0 compliant manufacturing",
        certifications_required: ["ISO 9001", "CE Marking", "Algerian Standards"]
      },
      factory_dimensions: {
        width: 50,
        length: 100,
        height: 8,
        floors: 1,
        total_area_sqm: 5000,
        production_area_sqm: 3500,
        storage_area_sqm: 1000,
        office_area_sqm: 400,
        utility_area_sqm: 100
      },
      production_process: "General Manufacturing",
      machinery: [],
      materials: [],
      capacity: "Standard capacity",
      assets: [],
      risk_assessment: {
        market_risks: ["Market demand fluctuations"],
        technical_risks: ["Equipment reliability"],
        supply_risks: ["Supply chain disruptions"],
        operational_risks: ["Operational challenges"],
        mitigation_strategies: ["Diversification", "Preventive maintenance", "Strategic reserves"]
      },
      scalability: {
        expansion_phases: ["Initial operation", "Capacity expansion", "Market expansion"],
        product_diversification: ["Core products", "Adjacent products"],
        capacity_growth: "100% expansion potential",
        technology_upgrades: ["IoT integration", "Automation upgrades"]
      }
    };
  }
}

export const planningService = new PlanningService();
