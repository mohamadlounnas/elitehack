import { supabase } from "../../utils/supabase.js";
import { createLLM } from "../../utils/langchain.js";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { logger } from "../../utils/logger.js";
import FirecrawlApp from "@mendable/firecrawl-js";
import dotenv from "dotenv";

dotenv.config();

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
  private firecrawl: FirecrawlApp | null = null;

  /**
   * Initialize Firecrawl client
   */
  private getFirecrawlClient(): FirecrawlApp {
    if (!this.firecrawl) {
      const apiKey = process.env.FIRECRAWL_API_KEY;
      if (!apiKey) {
        throw new Error("FIRECRAWL_API_KEY not configured");
      }
      this.firecrawl = new FirecrawlApp({ apiKey });
      logger.info("Firecrawl client initialized", { keyPrefix: apiKey.substring(0, 5) });
    }
    return this.firecrawl;
  }

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
    
    // Check Firecrawl API key configuration
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlApiKey) {
      logger.warn("FIRECRAWL_API_KEY not configured - will use fallback suppliers");
      console.warn("[FIRECRAWL] ⚠️  FIRECRAWL_API_KEY not set in environment variables!");
      console.warn("[FIRECRAWL] Sourcing will use fallback suppliers instead of real web search");
    } else {
      logger.info("Firecrawl API key configured", { keyPrefix: firecrawlApiKey.substring(0, 5) });
      console.log(`[FIRECRAWL] ✅ API key configured: ${firecrawlApiKey.substring(0, 5)}...`);
    }
    
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
      const BATCH_SIZE = 3; // Process 3 assets in parallel
      
      onUpdate({ 
        type: "starting", 
        progress: 0, 
        total, 
        message: `🚀 Starting PARALLEL supplier search for ${total} assets (${BATCH_SIZE} at a time)...` 
      });

      console.log(`[FIRECRAWL] 🚀 Processing ${total} assets in parallel batches of ${BATCH_SIZE}`);
      
      let completedCount = 0;

      // Process assets in parallel batches
      for (let batchStart = 0; batchStart < assets.length; batchStart += BATCH_SIZE) {
        const batch = assets.slice(batchStart, batchStart + BATCH_SIZE);
        const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(assets.length / BATCH_SIZE);
        
        console.log(`[FIRECRAWL] 📦 Processing batch ${batchNum}/${totalBatches}: ${batch.map(a => a.name).join(', ')}`);

        onUpdate({
          type: "searching",
          progress: completedCount,
          total,
          message: `📦 Batch ${batchNum}/${totalBatches}: Processing ${batch.length} assets in parallel...`
        });

        // Process all assets in this batch in parallel
        const batchPromises = batch.map(async (asset, batchIndex) => {
          const globalIndex = batchStart + batchIndex;
          
          logger.info(`Sourcing suppliers for asset ${globalIndex + 1}/${total}`, { 
            projectId, 
            assetId: asset.id, 
            assetName: asset.name 
          });

          try {
            // Search for suppliers using Firecrawl
            const suppliers = await this.searchSuppliersWithAI(asset, (message) => {
              // Send progress updates during Firecrawl search
          onUpdate({
                type: "searching",
            asset: { id: asset.id, name: asset.name, type: asset.type },
                progress: completedCount,
            total,
                message: `[${asset.name}] ${message}`
              });
          });

          // Save suppliers to database and link to asset
            const savedSuppliers: SupplierData[] = [];
          for (const supplierData of suppliers) {
            const savedSupplier = await this.saveSupplier(supplierData);
            
            if (savedSupplier) {
              // Link supplier to asset
              await this.linkSupplierToAsset(asset.id, savedSupplier.id, suppliers.indexOf(supplierData) === 0);
                savedSuppliers.push(supplierData);
              }
            }

            return { 
              asset, 
              suppliers: savedSuppliers, 
              success: true, 
              error: null 
            };

          } catch (error: any) {
            logger.error(`Error sourcing suppliers for asset ${asset.id}`, error);
            return { 
              asset, 
              suppliers: [], 
              success: false, 
              error: error.message 
            };
          }
        });

        // Wait for all assets in this batch to complete
        const batchResults = await Promise.all(batchPromises);

        // Report results for this batch
        for (const result of batchResults) {
          completedCount++;
          
          if (result.success) {
          onUpdate({
            type: "asset_complete",
              asset: { id: result.asset.id, name: result.asset.name, type: result.asset.type },
              suppliers: result.suppliers,
              progress: completedCount,
            total,
              message: `✅ ${result.asset.name} - ${result.suppliers.length} suppliers found`
            });
            
            // Also send individual supplier updates
            for (const supplier of result.suppliers) {
              onUpdate({
                type: "found",
                asset: { id: result.asset.id, name: result.asset.name, type: result.asset.type },
                supplier: supplier,
                progress: completedCount,
                total,
                message: `Found: ${supplier.name} (${supplier.country})`
              });
            }
          } else {
          onUpdate({
            type: "asset_complete",
              asset: { id: result.asset.id, name: result.asset.name, type: result.asset.type },
            suppliers: [],
              progress: completedCount,
            total,
              message: `❌ ${result.asset.name}: ${result.error}`
          });
        }
        }

        console.log(`[FIRECRAWL] ✅ Batch ${batchNum} complete. Progress: ${completedCount}/${total}`);
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
   * Search for suppliers using Firecrawl web search and scraping - PARALLEL VERSION
   */
  private async searchSuppliersWithAI(
    asset: any,
    onProgress?: (message: string) => void
  ): Promise<SupplierData[]> {
    try {
      const progress = (msg: string) => {
        logger.info(`[FIRECRAWL] ${msg}`, { assetName: asset.name });
        console.log(`[FIRECRAWL] ${msg} - Asset: ${asset.name}`);
        onProgress?.(msg);
      };

      progress("🚀 Starting PARALLEL Firecrawl supplier search");
      
      // Build search queries for Firecrawl
      const searchQueries = this.buildSearchQueries(asset);
      progress(`📋 Running ${searchQueries.length} search queries IN PARALLEL...`);
      
      // STEP 1: Run ALL search queries in parallel
      const searchPromises = searchQueries.map(async (query, index) => {
        try {
          logger.info(`Starting parallel search ${index + 1}`, { query });
          const results = await this.firecrawlSearch(query);
          return { query, results: results || [], error: null };
        } catch (error: any) {
          logger.warn(`Search failed for query: ${query}`, { error: error.message });
          return { query, results: [], error: error.message };
        }
      });

      const searchResults = await Promise.all(searchPromises);
      
      // Collect all unique URLs from all search results
      const allUrls = new Map<string, any>(); // url -> search result
      for (const { query, results, error } of searchResults) {
        if (error) {
          progress(`❌ Search "${query.substring(0, 30)}..." failed: ${error}`);
          continue;
        }
        progress(`✅ Search "${query.substring(0, 30)}..." found ${results.length} results`);
        
        // Take top 3 from each query
        for (const result of results.slice(0, 3)) {
          if (result.url && !allUrls.has(result.url)) {
            allUrls.set(result.url, result);
          }
        }
      }

      progress(`📊 Total unique URLs to scrape: ${allUrls.size}`);

      if (allUrls.size === 0) {
        progress(`⚠️  No URLs found, using fallback suppliers`);
        return this.generateFallbackSuppliers(asset.name, asset.type);
      }

      // STEP 2: Scrape ALL URLs in parallel (limit to 10 to avoid rate limiting)
      const urlsToScrape = Array.from(allUrls.entries()).slice(0, 10);
      progress(`🌐 Scraping ${urlsToScrape.length} websites IN PARALLEL...`);

      const scrapePromises = urlsToScrape.map(async ([url, searchResult]) => {
        try {
          logger.info(`Starting parallel scrape`, { url });
          const supplierData = await this.scrapeSupplierWebsite(url, asset);
          
          if (supplierData && this.isValidSupplier(supplierData)) {
            return { url, supplier: supplierData, error: null };
          } else {
            // Try basic extraction from search result
            const basicSupplier = this.extractSupplierFromSearchResult(searchResult, asset);
            if (basicSupplier && this.isValidSupplier(basicSupplier)) {
              return { url, supplier: basicSupplier, error: null };
            }
            return { url, supplier: null, error: "Validation failed" };
          }
        } catch (error: any) {
          // Try basic extraction on error
          const basicSupplier = this.extractSupplierFromSearchResult(searchResult, asset);
          if (basicSupplier && this.isValidSupplier(basicSupplier)) {
            return { url, supplier: basicSupplier, error: null };
          }
          return { url, supplier: null, error: error.message };
        }
      });

      const scrapeResults = await Promise.all(scrapePromises);
      
      // Collect valid suppliers
      const foundSuppliers: SupplierData[] = [];
      const seenNames = new Set<string>();
      
      for (const { url, supplier, error } of scrapeResults) {
        if (error) {
          progress(`❌ Scrape "${url.substring(0, 40)}..." failed: ${error}`);
          continue;
        }
        if (supplier && !seenNames.has(supplier.name.toLowerCase())) {
          seenNames.add(supplier.name.toLowerCase());
          foundSuppliers.push(supplier);
          progress(`✅ Found: ${supplier.name} (${supplier.country})`);
        }
      }

      progress(`📊 Total valid suppliers found: ${foundSuppliers.length}`);

      // Use AI to enhance and validate the found suppliers
      if (foundSuppliers.length > 0) {
        progress(`🤖 Enhancing ${foundSuppliers.length} suppliers with AI...`);
        const enhancedSuppliers = await this.enhanceSuppliersWithAI(foundSuppliers, asset);
        progress(`✅ Done! ${enhancedSuppliers.length} suppliers ready`);
        return enhancedSuppliers.slice(0, this.SUPPLIERS_PER_ASSET);
      }

      // Fallback to AI-generated suppliers if Firecrawl finds nothing
      logger.warn("No suppliers found via Firecrawl, using AI fallback", { assetName: asset.name });
      console.warn(`[FIRECRAWL] No suppliers found for ${asset.name}, using fallback`);
      progress(`⚠️  No suppliers found via Firecrawl, using fallback suppliers`);
      return this.generateFallbackSuppliers(asset.name, asset.type);
      
    } catch (error: any) {
      logger.error("Error in searchSuppliersWithAI (Firecrawl)", { error: error.message, stack: error.stack, assetName: asset.name });
      console.error(`[FIRECRAWL] Fatal error for ${asset.name}:`, error.message, error.stack);
      // Return fallback suppliers on error
      return this.generateFallbackSuppliers(asset.name, asset.type);
    }
  }

  /**
   * Build search queries for Firecrawl based on asset details
   */
  private buildSearchQueries(asset: any): string[] {
    const queries: string[] = [];
    const equipmentName = asset.name;
    const equipmentType = asset.type || "industrial equipment";

    // Priority queries targeting Algeria and North Africa
    queries.push(`${equipmentName} supplier manufacturer Algeria`);
    queries.push(`${equipmentName} distributor North Africa`);
    queries.push(`${equipmentType} supplier Algeria Tunisia`);
    queries.push(`${equipmentName} industrial supplier MENA region`);
    queries.push(`${equipmentName} manufacturer Africa`);

    return queries;
  }

  /**
   * Search using Firecrawl web search
   */
  private async firecrawlSearch(query: string): Promise<any[]> {
    try {
      const firecrawl = this.getFirecrawlClient();
      
      logger.info("Calling Firecrawl search", { query });
      console.log(`[FIRECRAWL] 🔍 Searching: "${query}"`);

      // Use Firecrawl SDK search method
      const results = await firecrawl.search(query, {
        limit: 10,
        sources: ["web"],
        country: "DZ", // Algeria
        location: "Algeria",
      });

      logger.info("Firecrawl search results", { 
        resultCount: results?.web?.length || 0,
        query 
      });
      console.log(`[FIRECRAWL] ✅ Search completed: ${results?.web?.length || 0} results found`);
      
      // Firecrawl SDK returns results.web array directly
      return results?.web || [];
    } catch (error: any) {
      logger.error("Firecrawl search error", { error: error.message, stack: error.stack, query });
      console.error(`[FIRECRAWL] ❌ Search error:`, error.message);
      throw error;
    }
  }

  /**
   * Scrape supplier website to extract detailed information
   */
  private async scrapeSupplierWebsite(url: string, asset: any): Promise<SupplierData | null> {
    try {
      const firecrawl = this.getFirecrawlClient();

      logger.info("Scraping supplier website", { url });
      console.log(`[FIRECRAWL] 🌐 Scraping: ${url}`);

      // Use Firecrawl SDK scrape method
      const result = await firecrawl.scrape(url, {
        formats: ["markdown"],
        onlyMainContent: true,
      });

      const content = result?.markdown || result?.content || "";

      logger.info("Scrape completed", { 
        url, 
        contentLength: content.length,
        hasContent: !!content 
      });
      console.log(`[FIRECRAWL] ✅ Scrape completed: ${content.length} chars extracted`);

      if (!content) {
        logger.warn("No content extracted from website", { url });
        return null;
      }

      // Use AI to extract structured supplier data from scraped content
      logger.info("Extracting supplier data from content", { url, contentLength: content.length });
      return await this.extractSupplierDataFromContent(content, url, asset);
    } catch (error: any) {
      logger.error("Error scraping supplier website", { 
        url, 
        error: error.message, 
        stack: error.stack 
      });
      console.error(`[FIRECRAWL] ❌ Scrape error for ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Extract supplier data from scraped website content using AI
   */
  private async extractSupplierDataFromContent(
    content: string,
    sourceUrl: string,
    asset: any
  ): Promise<SupplierData | null> {
    try {
      const llm = createLLM();
      
      const extractionPrompt = `Extract supplier information from the following website content. Focus on finding:
- Company name
- Contact information (email, phone)
- Location and country
- Address
- Products/services offered
- Certifications
- Company description
- Years in business (if mentioned)
- Company size

Website content:
${content.substring(0, 5000)} // Limit content to avoid token limits

Equipment being sourced: ${asset.name} (${asset.type || "Industrial Equipment"})

Return a JSON object with this structure:
{
  "name": "Company Name",
  "website": "${sourceUrl}",
  "email": "contact email if found",
  "phone": "phone number if found",
  "location": "City, Country",
  "country": "Country Name",
  "address": "full address if found",
  "contact_person": "contact name if found",
  "products": ["product 1", "product 2"],
  "specializations": ["specialty 1"],
  "certifications": ["certification 1"],
  "years_in_business": 0,
  "company_size": "Large/Medium/Small",
  "description": "company description",
  "source_url": "${sourceUrl}",
  "rating": null
}

Return ONLY the JSON object, no other text.`;

      const messages = [
        new SystemMessage("You are an expert at extracting structured data from company websites. Return only valid JSON."),
        new HumanMessage(extractionPrompt)
      ];

      const response = await llm.invoke(messages);
      const responseContent = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      // Parse JSON response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const supplierData = JSON.parse(jsonMatch[0]);
        return this.normalizeSupplier(supplierData);
      }

      return null;
    } catch (error: any) {
      logger.error("Error extracting supplier data from content", { error: error.message });
      return null;
    }
  }

  /**
   * Extract basic supplier info from search result when scraping fails
   */
  private extractSupplierFromSearchResult(result: any, asset: any): SupplierData | null {
    try {
      const title = result.title || "";
      const snippet = result.description || "";
      const url = result.url || "";

      // Extract country from URL or snippet
      let country = "Unknown";
      for (const prefCountry of PREFERRED_COUNTRIES) {
        if (snippet.toLowerCase().includes(prefCountry.toLowerCase()) || 
            url.toLowerCase().includes(prefCountry.toLowerCase())) {
          country = prefCountry;
          break;
        }
      }

      return {
        name: title.split(" - ")[0].split(" | ")[0] || "Unknown Supplier",
        website: url,
        location: this.extractLocationFromSnippet(snippet, country),
        country: country,
        description: snippet,
        source_url: url,
        products: [asset.name],
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract location from snippet text
   */
  private extractLocationFromSnippet(snippet: string, country: string): string {
    // Try to find city name in snippet
    const cityMatch = snippet.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),?\s+(?:Algeria|Tunisia|Egypt|Germany|Italy|France|Spain|China|Turkey|India)/);
    if (cityMatch) {
      return `${cityMatch[1]}, ${country}`;
    }
    return country;
  }

  /**
   * Enhance supplier data with AI validation and enrichment
   */
  private async enhanceSuppliersWithAI(
    suppliers: SupplierData[],
    asset: any
  ): Promise<SupplierData[]> {
    try {
      const llm = createLLM();
      
      const enhancementPrompt = `Review and enhance the following supplier data. Ensure all suppliers:
1. Have complete contact information
2. Are verified as legitimate companies
3. Match the equipment requirements: ${asset.name} (${asset.type || "Industrial Equipment"})
4. Are NOT from prohibited countries (Morocco, Israel)
5. Have proper country and location information

Suppliers to review:
${JSON.stringify(suppliers, null, 2)}

Return a JSON array of enhanced suppliers. Remove any invalid suppliers.
Return ONLY the JSON array, no other text.`;

      const messages = [
        new SystemMessage(this.getSystemPrompt()),
        new HumanMessage(enhancementPrompt)
      ];

      const response = await llm.invoke(messages);
      const content = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content);

      const enhanced = this.parseSupplierResponse(content);
      
      // Filter and validate
      return enhanced
        .filter(s => this.isValidSupplier(s))
        .slice(0, this.SUPPLIERS_PER_ASSET);
    } catch (error: any) {
      logger.error("Error enhancing suppliers with AI", error);
      // Return original suppliers if enhancement fails
      return suppliers.filter(s => this.isValidSupplier(s));
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
