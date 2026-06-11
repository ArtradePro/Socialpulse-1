import { ScrapedLeadData } from "../types/automation";

/**
 * Service to scrape Google Maps and enrich contact data using Outscraper API
 */
export async function scrapeGoogleMaps(
  query: string,
  location: string,
  limit: number = 20
): Promise<ScrapedLeadData[]> {
  const apiKey = process.env.OUTSCRAPER_API_KEY;

  if (!apiKey || apiKey.includes("placeholder") || apiKey.includes("dummy")) {
    console.warn("⚠️ No Outscraper API Key found in env. Running in Sandbox Simulation Mode.");
    return generateSandboxLeads(query, location, limit);
  }

  try {
    const fullQuery = `${query} in ${location}`;
    console.log(`📡 Outscraper: Scraping Google Maps for "${fullQuery}" (limit: ${limit})`);
    
    // Outscraper Google Maps + Email/Phone Enricher endpoint
    const url = `https://api.outscraper.com/maps/search-v2?query=${encodeURIComponent(
      fullQuery
    )}&limit=${limit}&async=false`;

    const response = await fetch(url, {
      headers: {
        "X-API-KEY": apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Outscraper API returned ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as any;
    
    // Outscraper returns results inside a nested array
    const results = data.data?.[0] || [];
    
    return results.map((item: any) => {
      // Outscraper review/rating competitor calculations
      const rating = item.rating || 4.0;
      // Synthesize competitor rating (e.g. average in area or offset)
      const competitorRating = Math.max(1.0, Math.min(5.0, rating + (Math.random() * 0.8 - 0.4)));

      return {
        businessName: item.name,
        email: item.email || item.emails?.[0] || undefined,
        phone: item.phone || item.phones?.[0] || undefined,
        address: item.full_address || item.address || undefined,
        city: item.city || location,
        category: item.subtypes?.[0] || item.type || query,
        rating: rating,
        reviewsCount: item.reviews_cnt || 0,
        website: item.site || item.website || undefined,
        competitorRating: parseFloat(competitorRating.toFixed(1))
      };
    });
  } catch (error: any) {
    console.error("❌ Outscraper API Error:", error);
    throw error;
  }
}

/**
 * Realistic Sandbox lead generator
 */
function generateSandboxLeads(query: string, location: string, limit: number): ScrapedLeadData[] {
  console.log(`🤖 Outscraper Sandbox: Simulating lead generation for "${query}" in "${location}"`);

  // Mock business names lists based on query type
  const isGarage =
    query.toLowerCase().includes("garage") ||
    query.toLowerCase().includes("junk") ||
    query.toLowerCase().includes("epoxy");

  const garagePrefixes = [
    "Elite Epoxy",
    "Apex Garage Door Services",
    "Pro-Reset",
    "Apex Junk Haulers",
    "Pretoria Garage Cabinets",
    "Sandton Epoxy Solutions",
    "Joburg Door & Spring",
    "Gauteng Storage Pros",
    "Randburg Door Doctors",
    "Vanguard Space Organizers"
  ];

  const contractorPrefixes = [
    "Vanguard Roofing Co",
    "Aero Solar Clean Energy",
    "Signature Flooring Specialists",
    "Austin Development Group",
    "Lone Star Solar installers",
    "Sydney Roofing & Gutters",
    "Summit Home Renovators",
    "Blue Sky Roofing",
    "Prestige Custom Paving",
    "Apex Flooring Systems"
  ];

  const businessList = isGarage ? garagePrefixes : contractorPrefixes;
  const categoriesList = isGarage
    ? ["Garage Door Repair", "Epoxy Flooring", "Junk Removal", "Storage Upgrades"]
    : ["Roofing Contractor", "Solar Panel Installation", "Flooring Contractor", "Property Development"];

  const emailsDomain = isGarage ? "garageguy.net" : "contractorshub.com";

  const leads: ScrapedLeadData[] = [];

  for (let i = 0; i < Math.min(limit, businessList.length); i++) {
    const name = `${businessList[i]} ${location.split(",")[0]}`;
    const basePhone = 720000000 + Math.floor(Math.random() * 9999999);
    const phone = location.toLowerCase().includes("austin") 
      ? `+1 (512) 555-${1000 + i}` 
      : `+27 82 ${basePhone.toString().substring(1, 4)} ${basePhone.toString().substring(4, 7)}`;
      
    const email = `${name.toLowerCase().replace(/[^a-z0-9]/g, "")}@${emailsDomain}`;
    const rating = parseFloat((3.5 + Math.random() * 1.5).toFixed(1));
    const reviewsCount = Math.floor(Math.random() * 180) + 5;
    
    // competitor rating
    const competitorRating = parseFloat((3.5 + Math.random() * 1.5).toFixed(1));

    leads.push({
      businessName: name,
      email,
      phone,
      address: `${100 + i * 22} Main Street, ${location}`,
      city: location.split(",")[0].trim(),
      category: categoriesList[i % categoriesList.length],
      rating,
      reviewsCount,
      website: `www.${name.toLowerCase().replace(/[^a-z0-9]/g, "")}.co.za`,
      competitorRating
    });
  }

  return leads;
}
