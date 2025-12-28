import { supabase } from "../../utils/supabase.js";
import { stepOrchestrator } from "../stepOrchestrator.js";
import axios from "axios";

type SourcingStreamCallback = (update: {
  type: "starting" | "searching" | "found" | "complete";
  asset?: { id: string; name: string };
  supplier?: { name: string; location: string; website?: string };
  progress: number;
  total: number;
}) => void;

class SourcingService {
  /**
   * Start sourcing with streaming updates
   */
  async startSourcingWithStream(
    projectId: string,
    onUpdate: SourcingStreamCallback
  ): Promise<void> {
    try {
      // Get all assets for the project
      const { data: assets } = await supabase
        .from("assets")
        .select("*")
        .eq("project_id", projectId);

      if (!assets || assets.length === 0) {
        // Steps are now manually triggered - user must click "Next Step" button
        return;
      }

      const total = assets.length;
      onUpdate({ type: "starting", progress: 0, total });

      // Search for suppliers for each asset
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        try {
          onUpdate({
            type: "searching",
            asset: { id: asset.id, name: asset.name },
            progress: i,
            total,
          });

          const suppliers = await this.searchSuppliers(asset.name, asset.type);

          // Create supplier records
          for (const supplierData of suppliers) {
            const { data: existingSupplier } = await supabase
              .from("suppliers")
              .select("id")
              .eq("name", supplierData.name)
              .single();

            let supplierId;
            if (existingSupplier) {
              supplierId = existingSupplier.id;
            } else {
              const { data: newSupplier } = await supabase
                .from("suppliers")
                .insert({
                  name: supplierData.name,
                  website: supplierData.website,
                  email: supplierData.email,
                  phone: supplierData.phone,
                  location: supplierData.location,
                  products: supplierData.products,
                })
                .select("id")
                .single();

              if (newSupplier) {
                supplierId = newSupplier.id;
              }
            }

            // Link asset to supplier
            if (supplierId) {
              await supabase
                .from("assets")
                .update({ supplier_id: supplierId })
                .eq("id", asset.id);

              onUpdate({
                type: "found",
                asset: { id: asset.id, name: asset.name },
                supplier: {
                  name: supplierData.name,
                  location: supplierData.location,
                  website: supplierData.website,
                },
                progress: i,
                total,
              });
            }
          }

          onUpdate({
            type: "complete",
            asset: { id: asset.id, name: asset.name },
            progress: i + 1,
            total,
          });
        } catch (error) {
          console.error(`Error sourcing suppliers for asset ${asset.id}:`, error);
          // Continue with next asset
        }
      }

      // Mark sourcing as complete
      await supabase
        .from("projects")
        .update({ current_step: "sourced" })
        .eq("id", projectId);

      // Steps are now manually triggered - user must click "Next Step" button
    } catch (error: any) {
      console.error("Error in sourcingService.startSourcingWithStream:", error);
      throw error;
    }
  }

  async startSourcing(projectId: string): Promise<void> {
    try {
      // Get all assets for the project
      const { data: assets } = await supabase
        .from("assets")
        .select("*")
        .eq("project_id", projectId);

      if (!assets || assets.length === 0) {
        // Steps are now manually triggered - user must click "Next Step" button
        return;
      }

      // Search for suppliers for each asset
      for (const asset of assets) {
        try {
          const suppliers = await this.searchSuppliers(asset.name, asset.type);

          // Create supplier records
          for (const supplierData of suppliers) {
            const { data: existingSupplier } = await supabase
              .from("suppliers")
              .select("id")
              .eq("name", supplierData.name)
              .single();

            let supplierId;
            if (existingSupplier) {
              supplierId = existingSupplier.id;
            } else {
              const { data: newSupplier } = await supabase
                .from("suppliers")
                .insert({
                  name: supplierData.name,
                  website: supplierData.website,
                  email: supplierData.email,
                  phone: supplierData.phone,
                  location: supplierData.location,
                  products: supplierData.products,
                })
                .select("id")
                .single();

              if (newSupplier) {
                supplierId = newSupplier.id;
              }
            }

            // Link asset to supplier
            if (supplierId) {
              await supabase
                .from("assets")
                .update({ supplier_id: supplierId })
                .eq("id", asset.id);
            }
          }
        } catch (error) {
          console.error(`Error sourcing suppliers for asset ${asset.id}:`, error);
          // Continue with next asset
        }
      }

      // Mark sourcing as complete
      await supabase
        .from("projects")
        .update({ current_step: "sourced" })
        .eq("id", projectId);

      // Steps are now manually triggered - user must click "Next Step" button
    } catch (error: any) {
      console.error("Error in sourcingService.startSourcing:", error);
      throw error;
    }
  }

  /**
   * Search for suppliers with strict compliance to Algeria's regulations
   * PROHIBITED: Morocco, Israel, and countries with bad relations with Algeria
   * PREFERRED: Algeria, African Union countries, countries with good diplomatic relations
   */
  private async searchSuppliers(productName: string, productType?: string): Promise<any[]> {
    // Placeholder implementation using Google Custom Search API
    // In production, this would use actual Google Search API or scraping
    const searchQuery = `${productName} ${productType || ""} supplier manufacturer Algeria African`;

    // PROHIBITED COUNTRIES - Must be filtered out
    const prohibitedCountries = [
      "Morocco", "Moroccan", "Maroc", "المغرب",
      "Israel", "Israeli", "Palestine occupation",
    ];

    // PREFERRED COUNTRIES - Prioritize these
    const preferredCountries = [
      "Algeria", "Algerian", "Algérie",
      "Tunisia", "Tunisian", "Tunisie",
      "Egypt", "Egyptian", "مصر",
      "South Africa", "South African",
      "Nigeria", "Nigerian",
      "Kenya", "Kenyan",
      "Ghana", "Ghanaian",
      "Senegal", "Senegalese",
      "African Union", "AU member",
    ];

    try {
      // For now, return mock supplier data that complies with Algeria's regulations
      // In production, implement actual Google Search API integration with filtering
      const suppliers = [
        {
          name: `${productName} Algerian Supplier`,
          website: "https://example.com/algerian-supplier",
          email: "contact@algerian-supplier.dz",
          phone: "+213XXXXXXXXX",
          location: "Algeria",
          products: [productName],
        },
        {
          name: `${productName} African Supplier`,
          website: "https://example.com/african-supplier",
          email: "info@african-supplier.com",
          phone: "+XXX-XXXXXXX",
          location: "Tunisia",
          products: [productName],
        },
      ];

      // Filter out any suppliers from prohibited countries
      return suppliers.filter(supplier => {
        const locationLower = supplier.location.toLowerCase();
        return !prohibitedCountries.some(prohibited => 
          locationLower.includes(prohibited.toLowerCase()) ||
          supplier.name.toLowerCase().includes(prohibited.toLowerCase())
        );
      });
    } catch (error) {
      console.error("Error in searchSuppliers:", error);
      return [];
    }
  }
}

export const sourcingService = new SourcingService();

