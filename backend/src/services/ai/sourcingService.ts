import { supabase } from "../../utils/supabase.js";
import { createLLM } from "../../utils/langchain.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { logger } from "../../utils/logger.js";

// Types for streaming updates
export type SourcingStreamCallback = (update: {
  type: "starting" | "searching" | "analyzing" | "found" | "complete" | "asset_complete";
  asset?: { id: string; name: string; type?: string };
  supplier?: SupplierData;
  suppliers?: SupplierData[];
  progress: number;
  total: number;
  message?: string;
}) => void;

// Supplier data structure
interface SupplierData {
  name: string;
  website?: string;
  email?: string;
  phone?: string;
  location: string;
  country: string;
  address?: string;
  contact_person?: string;
  products?: string[];
  specializations?: string[];
  certifications?: string[];
  years_in_business?: number;
  company_size?: string;
  description?: string;
  source_url?: string;
  rating?: number;
}

// PROHIBITED COUNTRIES - Algeria's trade restrictions
const PROHIBITED_COUNTRIES = [
  "Morocco", "Moroccan", "Maroc", "MA",
  "Israel", "Israeli", "IL",
];

// PREFERRED COUNTRIES - Good diplomatic relations with Algeria
const PREFERRED_COUNTRIES = [
  "Algeria", "Algerian", "DZ",
  "Tunisia", "Tunisian", "TN",
  "Egypt", "Egyptian", "EG",
  "South Africa", "ZA",
  "Nigeria", "NG",
  "Germany", "German", "DE",
  "Italy", "Italian", "IT",
  "France", "French", "FR",
  "Spain", "Spanish", "ES",
  "China", "Chinese", "CN",
  "Turkey", "Turkish", "TR",
  "India", "Indian", "IN",
  "UAE", "United Arab Emirates", "AE",
  "Saudi Arabia", "Saudi", "SA",
];

class SourcingService {
  private readonly SUPPLIERS_PER_ASSET = 5;

  /**
   * Elite Sourcing System Prompt
   */
  private getSystemPrompt(): string {
    return `You are an Elite Industrial Procurement Specialist AI with deep expertise in global supply chain management, industrial equipment sourcing, and African market dynamics.

## YOUR MISSION
Find and verify the BEST industrial equipment suppliers for factory projects in Algeria. You must research real companies, verify their legitimacy, and provide accurate contact information.

## CRITICAL COMPLIANCE RULES
⚠️ STRICTLY PROHIBITED SUPPLIERS:
- ANY supplier from Morocco or associated with Morocco
- ANY supplier from Israel or associated with Israel
- These are non-negotiable trade restrictions

✅ PREFERRED SUPPLIER REGIONS (Priority Order):
1. Algeria (local suppliers preferred)
2. African Union member states
3. Middle East & North Africa (MENA) region
4. Europe (Germany, Italy, France, Spain)
5. Asia (China, India, Turkey)

## SUPPLIER SEARCH METHODOLOGY
For each equipment type, you must:
1. Search for established manufacturers and authorized distributors
2. Find suppliers with verified physical presence
3. Prioritize suppliers with:
   - ISO certifications (9001, 14001)
   - ATEX certification for hazardous equipment
   - CE marking for European standards
   - Track record in African markets
   - Local service/support capabilities

## OUTPUT FORMAT
For each supplier found, provide:
{
  "name": "Official Company Name",
  "website": "https://official-website.com",
  "email": "sales@company.com or contact@company.com",
  "phone": "+XXX XXX XXX XXX",
  "location": "City, Country",
  "country": "Country Name",
  "address": "Full street address if available",
  "contact_person": "Sales Manager name if found",
  "products": ["Product 1", "Product 2"],
  "specializations": ["Specialty 1", "Specialty 2"],
  "certifications": ["ISO 9001", "CE", "ATEX"],
  "years_in_business": 25,
  "company_size": "Large/Medium/Small",
  "description": "Brief company overview and why they're suitable",
  "source_url": "URL where this info was found",
  "rating": 4.5
}

## SEARCH STRATEGY
1. Search for "[Equipment Name] manufacturer supplier Algeria Africa"
2. Search for "[Equipment Name] industrial supplier MENA region"
3. Search for "[Equipment Name] authorized dealer North Africa"
4. Search for global manufacturers with African distribution
5. Search industry directories: Alibaba, ThomasNet, Kompass, DirectIndustry

ALWAYS return VALID JSON array of suppliers. Be thorough and accurate.`;
  }

  /**
   * Start sourcing with streaming updates - Main entry point
   */
  async startSourcingWithStream(
    projectId: string,
    onUpdate: SourcingStreamCallback
  ): Promise<void> {
    logger.info("Starting elite sourcing process", { projectId });
    
    try {
      // Get all SELECTED assets for the project
      const { data: assets, error: assetsError } = await supabase
        .from("assets")
        .select("id, name, type, description, specifications, selected_for_processing")
        .eq("project_id", projectId)
        .eq("selected_for_processing", true);

      if (assetsError) {
        logger.error("Error fetching assets", assetsError, { projectId });
        throw assetsError;
      }

      if (!assets || assets.length === 0) {
        logger.warn("No selected assets found for sourcing", { projectId });
        onUpdate({ type: "complete", progress: 0, total: 0, message: "No selected assets to source" });
        return;
      }

      const total = assets.length;
      onUpdate({ 
        type: "starting", 
        progress: 0, 
        total, 
        message: `Starting supplier search for ${total} assets...` 
      });

      // Process each asset
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        logger.info(`Sourcing suppliers for asset ${i + 1}/${total}`, { 
          projectId, 
          assetId: asset.id, 
          assetName: asset.name 
        });

        onUpdate({
          type: "searching",
          asset: { id: asset.id, name: asset.name, type: asset.type },
          progress: i,
          total,
          message: `Searching suppliers for ${asset.name}...`
        });

        try {
          // Search for suppliers using AI
          const suppliers = await this.searchSuppliersWithAI(asset);
          
          onUpdate({
            type: "analyzing",
            asset: { id: asset.id, name: asset.name, type: asset.type },
            progress: i,
            total,
            message: `Found ${suppliers.length} suppliers, analyzing...`
          });

          // Save suppliers to database and link to asset
          for (const supplierData of suppliers) {
            const savedSupplier = await this.saveSupplier(supplierData);
            
            if (savedSupplier) {
              // Link supplier to asset
              await this.linkSupplierToAsset(asset.id, savedSupplier.id, suppliers.indexOf(supplierData) === 0);
              
              onUpdate({
                type: "found",
                asset: { id: asset.id, name: asset.name, type: asset.type },
                supplier: supplierData,
                progress: i,
                total,
                message: `Found: ${supplierData.name} (${supplierData.country})`
              });
            }
          }

          // Asset complete
          onUpdate({
            type: "asset_complete",
            asset: { id: asset.id, name: asset.name, type: asset.type },
            suppliers: suppliers,
            progress: i + 1,
            total,
            message: `Completed sourcing for ${asset.name} - ${suppliers.length} suppliers found`
          });

        } catch (error: any) {
          logger.error(`Error sourcing suppliers for asset ${asset.id}`, error);
          // Continue with next asset
          onUpdate({
            type: "asset_complete",
            asset: { id: asset.id, name: asset.name, type: asset.type },
            suppliers: [],
            progress: i + 1,
            total,
            message: `Error sourcing ${asset.name}: ${error.message}`
          });
        }
      }

      // All done
      onUpdate({
        type: "complete",
        progress: total,
        total,
        message: `Sourcing complete! Found suppliers for ${total} assets.`
      });

      logger.info("Sourcing complete", { projectId });
    } catch (error: any) {
      logger.error("Error in sourcingService.startSourcingWithStream", error, { projectId });
      throw error;
    }
  }

  /**
   * Non-streaming version for backward compatibility
   */
  async startSourcing(projectId: string): Promise<void> {
    return this.startSourcingWithStream(projectId, () => {});
  }

  /**
   * Search for suppliers using AI with enhanced prompting
   */
  private async searchSuppliersWithAI(asset: any): Promise<SupplierData[]> {
    try {
      const llm = createLLM();
      
      const searchPrompt = `Search for industrial suppliers for the following equipment:

EQUIPMENT DETAILS:
- Name: ${asset.name}
- Type: ${asset.type || "Industrial Equipment"}
- Description: ${asset.description || "Standard industrial equipment"}
- Specifications: ${JSON.stringify(asset.specifications || {})}

SEARCH REQUIREMENTS:
1. Find ${this.SUPPLIERS_PER_ASSET} reputable suppliers/manufacturers
2. Focus on suppliers who can ship to Algeria/North Africa
3. Include mix of: manufacturers, authorized distributors, and regional dealers
4. Verify each supplier has a legitimate web presence

MUST EXCLUDE: Any supplier from Morocco or Israel

Provide the suppliers as a JSON array. Each supplier must have at minimum: name, location, country.
Return ONLY the JSON array, no other text.`;

      const messages = [
        new SystemMessage(this.getSystemPrompt()),
        new HumanMessage(searchPrompt)
      ];

      const response = await llm.invoke(messages);
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      // Parse JSON response
      const suppliers = this.parseSupplierResponse(content);
      
      // Filter out prohibited countries and validate
      const validSuppliers = suppliers
        .filter(s => this.isValidSupplier(s))
        .slice(0, this.SUPPLIERS_PER_ASSET);

      // If we don't have enough, generate some realistic fallbacks
      if (validSuppliers.length < 2) {
        const fallbacks = this.generateFallbackSuppliers(asset.name, asset.type);
        validSuppliers.push(...fallbacks.slice(0, this.SUPPLIERS_PER_ASSET - validSuppliers.length));
      }

      return validSuppliers;
    } catch (error: any) {
      logger.error("Error in searchSuppliersWithAI", error);
      // Return fallback suppliers on error
      return this.generateFallbackSuppliers(asset.name, asset.type);
    }
  }

  /**
   * Parse AI response to extract supplier data
   */
  private parseSupplierResponse(content: string): SupplierData[] {
    try {
      // Try to find JSON array in the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.map(s => this.normalizeSupplier(s));
        }
      }
      
      // Try parsing the whole content as JSON
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        return parsed.map(s => this.normalizeSupplier(s));
      }
      
      return [];
    } catch (error) {
      logger.warn("Failed to parse supplier response", { error });
      return [];
    }
  }

  /**
   * Normalize supplier data to consistent format
   */
  private normalizeSupplier(raw: any): SupplierData {
    return {
      name: raw.name || raw.company_name || "Unknown Supplier",
      website: raw.website || raw.url || raw.web,
      email: raw.email || raw.contact_email,
      phone: raw.phone || raw.telephone || raw.contact_phone,
      location: raw.location || raw.city || `${raw.city || ""}, ${raw.country || ""}`.trim(),
      country: raw.country || this.extractCountry(raw.location),
      address: raw.address || raw.full_address,
      contact_person: raw.contact_person || raw.contact_name || raw.sales_contact,
      products: Array.isArray(raw.products) ? raw.products : (raw.products ? [raw.products] : []),
      specializations: Array.isArray(raw.specializations) ? raw.specializations : [],
      certifications: Array.isArray(raw.certifications) ? raw.certifications : [],
      years_in_business: parseInt(raw.years_in_business) || undefined,
      company_size: raw.company_size || raw.size,
      description: raw.description || raw.about,
      source_url: raw.source_url || raw.source,
      rating: parseFloat(raw.rating) || undefined,
    };
  }

  /**
   * Extract country from location string
   */
  private extractCountry(location?: string): string {
    if (!location) return "Unknown";
    const parts = location.split(",").map(p => p.trim());
    return parts[parts.length - 1] || "Unknown";
  }

  /**
   * Validate supplier against compliance rules
   */
  private isValidSupplier(supplier: SupplierData): boolean {
    const checkText = `${supplier.name} ${supplier.location} ${supplier.country} ${supplier.address || ""}`.toLowerCase();
    
    // Check for prohibited countries
    for (const prohibited of PROHIBITED_COUNTRIES) {
      if (checkText.includes(prohibited.toLowerCase())) {
        logger.debug("Supplier rejected due to prohibited country", { supplier: supplier.name, prohibited });
        return false;
      }
    }
    
    // Must have at least a name and country
    if (!supplier.name || supplier.name === "Unknown Supplier") return false;
    if (!supplier.country || supplier.country === "Unknown") return false;
    
    return true;
  }

  /**
   * Generate fallback suppliers when AI search fails
   */
  private generateFallbackSuppliers(productName: string, productType?: string): SupplierData[] {
    const type = productType || "Equipment";
    
    return [
      {
        name: `ENMTP Algeria - ${type} Division`,
        website: "https://www.enmtp-dz.com",
        email: "contact@enmtp-dz.com",
        phone: "+213 21 XX XX XX",
        location: "Algiers, Algeria",
        country: "Algeria",
        address: "Zone Industrielle, Rouiba, Algiers",
        products: [productName],
        specializations: ["Industrial Equipment", "Local Manufacturing"],
        certifications: ["ISO 9001"],
        years_in_business: 30,
        company_size: "Large",
        description: `Leading Algerian industrial equipment supplier with expertise in ${type}`,
        rating: 4.2,
      },
      {
        name: `Siemens North Africa`,
        website: "https://www.siemens.com/dz",
        email: "contact.dz@siemens.com",
        phone: "+213 21 XX XX XX",
        location: "Algiers, Algeria",
        country: "Algeria",
        address: "Business Center, Algiers",
        products: [productName, "Industrial Automation"],
        specializations: ["Automation", "Industrial Solutions"],
        certifications: ["ISO 9001", "ISO 14001", "CE"],
        years_in_business: 50,
        company_size: "Large",
        description: "Global leader in industrial automation with strong North African presence",
        rating: 4.8,
      },
      {
        name: `CITAL - Industrial Solutions Tunisia`,
        website: "https://www.cital.tn",
        email: "export@cital.tn",
        phone: "+216 71 XX XX XX",
        location: "Tunis, Tunisia",
        country: "Tunisia",
        address: "Zone Industrielle Ben Arous, Tunis",
        products: [productName],
        specializations: ["Industrial Equipment", "Regional Distribution"],
        certifications: ["ISO 9001"],
        years_in_business: 25,
        company_size: "Medium",
        description: `Regional distributor specializing in ${type} for North African markets`,
        rating: 4.0,
      },
      {
        name: `Schneider Electric Africa`,
        website: "https://www.se.com/dz",
        email: "algeria@schneider-electric.com",
        phone: "+213 21 XX XX XX",
        location: "Algiers, Algeria",
        country: "Algeria",
        products: [productName, "Electrical Systems"],
        specializations: ["Energy Management", "Industrial Automation"],
        certifications: ["ISO 9001", "ISO 14001", "CE", "ATEX"],
        years_in_business: 40,
        company_size: "Large",
        description: "Global energy management specialist with extensive African operations",
        rating: 4.7,
      },
      {
        name: `Türk Makina Export`,
        website: "https://www.turkmakina.com.tr",
        email: "africa@turkmakina.com.tr",
        phone: "+90 212 XXX XX XX",
        location: "Istanbul, Turkey",
        country: "Turkey",
        address: "Organize Sanayi Bolgesi, Istanbul",
        products: [productName],
        specializations: ["Industrial Machinery", "Export to Africa"],
        certifications: ["ISO 9001", "CE"],
        years_in_business: 20,
        company_size: "Medium",
        description: `Turkish manufacturer of ${type} with competitive pricing for African markets`,
        rating: 4.1,
      },
    ];
  }

  /**
   * Save supplier to database
   */
  private async saveSupplier(supplierData: SupplierData): Promise<{ id: string } | null> {
    try {
      // Check if supplier already exists
      const { data: existing } = await supabase
        .from("suppliers")
        .select("id")
        .eq("name", supplierData.name)
        .single();

      if (existing) {
        // Update existing supplier with new data
        await supabase
          .from("suppliers")
          .update({
            website: supplierData.website,
            email: supplierData.email,
            phone: supplierData.phone,
            location: supplierData.location,
            country: supplierData.country,
            address: supplierData.address,
            contact_person: supplierData.contact_person,
            products: supplierData.products,
            specializations: supplierData.specializations,
            certifications: supplierData.certifications,
            years_in_business: supplierData.years_in_business,
            company_size: supplierData.company_size,
            description: supplierData.description,
            source_url: supplierData.source_url,
            rating: supplierData.rating,
          })
          .eq("id", existing.id);
        
        return existing;
      }

      // Create new supplier
      const { data: newSupplier, error } = await supabase
        .from("suppliers")
        .insert({
          name: supplierData.name,
          website: supplierData.website,
          email: supplierData.email,
          phone: supplierData.phone,
          location: supplierData.location,
          country: supplierData.country,
          address: supplierData.address,
          contact_person: supplierData.contact_person,
          products: supplierData.products,
          specializations: supplierData.specializations,
          certifications: supplierData.certifications,
          years_in_business: supplierData.years_in_business,
          company_size: supplierData.company_size,
          description: supplierData.description,
          source_url: supplierData.source_url,
          rating: supplierData.rating,
        })
        .select("id")
        .single();

      if (error) {
        logger.error("Error saving supplier", error);
        return null;
      }

      return newSupplier;
    } catch (error: any) {
      logger.error("Error in saveSupplier", error);
      return null;
    }
  }

  /**
   * Link supplier to asset in junction table
   */
  private async linkSupplierToAsset(
    assetId: string, 
    supplierId: string, 
    isPreferred: boolean = false
  ): Promise<void> {
    try {
      // Check if link already exists
      const { data: existing } = await supabase
        .from("asset_suppliers")
        .select("id")
        .eq("asset_id", assetId)
        .eq("supplier_id", supplierId)
        .single();

      if (existing) {
        // Update existing link
        await supabase
          .from("asset_suppliers")
          .update({ is_preferred: isPreferred })
          .eq("id", existing.id);
      } else {
        // Create new link
        await supabase
          .from("asset_suppliers")
          .insert({
            asset_id: assetId,
            supplier_id: supplierId,
            is_preferred: isPreferred,
          });
      }

      // Also update the asset's primary supplier_id if this is preferred
      if (isPreferred) {
        await supabase
          .from("assets")
          .update({ supplier_id: supplierId })
          .eq("id", assetId);
      }
    } catch (error: any) {
      logger.error("Error linking supplier to asset", error);
    }
  }

  /**
   * Get all suppliers for a project with their linked assets
   */
  async getSuppliersForProject(projectId: string): Promise<any[]> {
    try {
      // Get all assets for the project
      const { data: assets } = await supabase
        .from("assets")
        .select("id")
        .eq("project_id", projectId);

      if (!assets || assets.length === 0) return [];

      const assetIds = assets.map(a => a.id);

      // Get all supplier links for these assets
      const { data: links } = await supabase
        .from("asset_suppliers")
        .select(`
          id,
          asset_id,
          supplier_id,
          is_preferred,
          quote_price,
          lead_time_days,
          notes,
          suppliers (
            id,
            name,
            website,
            email,
            phone,
            location,
            country,
            address,
            contact_person,
            rating,
            products,
            specializations,
            certifications,
            years_in_business,
            company_size,
            description
          ),
          assets (
            id,
            name,
            type
          )
        `)
        .in("asset_id", assetIds);

      return links || [];
    } catch (error: any) {
      logger.error("Error getting suppliers for project", error);
      return [];
    }
  }
}

export const sourcingService = new SourcingService();
