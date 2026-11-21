# ==============================================================================
# HIGIENELABS MASTER CAMPAIGN MATRIX & CONTENT PLAYBOOK
# Entity: Higiene (Pty) Ltd — Higienlabs Technology Division
# System: SocialPulse Autonomous Multi-Platform Marketing Engine
# Supported Channels: TikTok, Instagram, Facebook, YouTube, LinkedIn
# Retail Endpoints: Takealot | Amazon | Shopify | Fungusnomore.co.za | Higiene.co.za
# Version: 1.0.0
# ==============================================================================

brand_governance:
  parent_company: "Higiene (Pty) Ltd"
  rd_division: "Higienlabs Technology Division"
  corporate_domain: "https://higiene.co.za"
  brand_domain_fnm: "https://fungusnomore.co.za"
  market_geos: ["South Africa (Primary)", "Sub-Saharan Africa", "International (Amazon)"]
  currency: "ZAR (R) / USD ($)"
  compliance_rules:
    - "Strictly preserve trademark slogan 'Love The Skin You're In.' exclusively for Fungus No More™."
    - "Strictly prohibit unverified 100% cure guarantees or unapproved prescription claims."
    - "Highlight active hygiene, lab-formulated bio-actives, fast symptom relief, and daily skin defense."
    - "Corporate spelling standard: Strictly 'Higiene' (never 'Hygiene')."

# ------------------------------------------------------------------------------
# PRODUCT 1: FUNGUS NO MORE™ (SHOWER GEL & ANTIFUNGAL SPRAY)
# Status: Active Production / Market Ready
# ------------------------------------------------------------------------------
products:
  - id: "prod_fnm_duo"
    name: "Fungus No More™ Dual-Action Defense (Sea Breeze & Pomegranate)"
    items:
      - name: "Fungus No More™ Antifungal Shower Gel (Sea Breeze)"
        volume: "500ml"
        form: "Wash-off cleansing lather"
        scent: "Sea Breeze"
        image_asset: "assets/products/fungus_no_more_sea_breeze_500ml.png"
      - name: "Fungus No More™ Antifungal Shower Gel (Pomegranate)"
        volume: "500ml"
        form: "Wash-off cleansing lather"
        scent: "Pomegranate"
        image_asset: "assets/products/fungus_no_more_pomegranate_500ml.png"
      - name: "Fungus No More™ Coconut Active Antifungal Spray"
        volume: "50ml"
        form: "Leave-on fast-dry mist"
        scent: "Coconut"
    bundles:
      - name: "Fungus No More™ 3-Bottle Routine Bundle"
        description: "Full daily shower and defense pack"
      - name: "Fungus No More™ 2-Pack Scent Bundle (Sea Breeze / Pomegranate)"
        description: "Twin-pack 500ml value bundle"
    slogan: "Love The Skin You're In."
    category: "Therapeutic Skin Hygiene & Antifungal Care"
    retail_endpoints:
      takealot: "https://www.takealot.com/fungus-no-more-antifungal-shower-gel-sea-breeze/PLID92742962"
      amazon: "https://www.amazon.com/dp/FUNGUSNOMORE"
      shopify: "https://shop.fungusnomore.co.za/products/fnm-duo"
      direct_fnm: "https://fungusnomore.co.za"
      direct_higiene: "https://higiene.co.za"
    authentic_media_assets:
      sea_breeze_png: "assets/products/fungus_no_more_sea_breeze_500ml.png"
      pomegranate_png: "assets/products/fungus_no_more_pomegranate_500ml.png"
      youtube_hero_ad: "docs/marketing/assets/fnm_youtube_hero_ad.jpg"
      youtube_end_card: "docs/marketing/assets/fnm_youtube_end_card.jpg"
      local_raw_video: "C:\\Users\\Venon\\OneDrive\\Higene\\Marketing\\Video\\Fungus No More 1 - 1714034378382.mp4"
    target_audiences:
      - segment: "Athletes, Gym-Goers & Runners"
        pain_points: ["Locker room floor bacteria", "Sweat-induced jock itch", "Athlete's foot", "Stubborn foot odor"]
        hook: "If you hit the gym or run daily, your standard body wash is not protecting your skin."
      - segment: "Everyday Consumers with Persistent Skin Irritation"
        pain_points: ["Recurring itching", "Embarrassment at the pool or beach", "Dry flaking skin between toes"]
        hook: "Stop hiding your skin. Two steps in the shower to wash away stubborn irritation."
      - segment: "Active Workers & Safety Boot Wearers"
        pain_points: ["Feet trapped in work boots for 10+ hours", "Damp moisture buildup", "Persistent shoe odor"]
        hook: "10 hours in work boots? Protect your feet before odor and fungus start."
    content_angles:
      - angle_id: "FNM-A1"
        name: "The Gym Bag Essential"
        platform_priority: ["tiktok", "instagram", "youtube_shorts"]
        visual_style: "Raw UGC locker room / gym shower aesthetic"
        key_benefit: "Instant wash-off defense + all-day spray protection"
      - angle_id: "FNM-A2"
        name: "The 10-Second Shower Reset"
        platform_priority: ["youtube_bumper", "facebook_video", "takealot_ads"]
        visual_style: "High-energy commercial, rapid problem-to-solution cut"
        key_benefit: "Clinical shower routine that replaces ordinary soap"
      - angle_id: "FNM-A3"
        name: "The Confidence Restorer"
        platform_priority: ["facebook", "instagram_feed", "shopify_landing"]
        visual_style: "Real review quotes, clean glowing skin lifestyle"
        key_benefit: "Love The Skin You're In. Walk barefoot without worry."

# ------------------------------------------------------------------------------
# PRODUCT 2: HIGIENLABS HAIR GROWTH & SCALP DENSITY (EXPANSION PIPELINE)
# Status: Formulation Phase (Higienlabs R&D)
# ------------------------------------------------------------------------------
  - id: "prod_higienlabs_hair_growth"
    name: "Higienlabs Follicle Defense & Hair Growth Formulation"
    items:
      - name: "Higienlabs Bio-Active Scalp Serum"
        volume: "50ml"
        form: "Targeted dropper applicator"
      - name: "Higienlabs Follicle Revitalizing Cleanser"
        volume: "250ml"
        form: "Sulfate-free DHT-clearing shampoo"
    category: "Trichological Scalp Therapy & Hair Restoration"
    lab_angle: "Formulated by Higienlabs Technology Division with bioactive peptides, caffeine complex, and micro-circulation boosters."
    retail_endpoints:
      takealot: "https://www.takealot.com/higienlabs-hair-growth"
      direct_higiene: "https://higiene.co.za/higienlabs/hair-growth"
      shopify: "https://shop.higiene.co.za/hair-growth"
    target_audiences:
      - segment: "Men with Receding Hairlines & Crown Thinning"
        pain_points: ["Premature hair loss", "DHT scalp sensitivity", "Clogged follicles"]
        hook: "Hair thinning doesn't start at the follicle tip — it starts at the scalp barrier."
      - segment: "Women Experiencing Post-Partum or Stress Shedding"
        pain_points: ["Diffuse shedding", "Widening part line", "Loss of hair volume"]
        hook: "Wake up sleeping follicles with lab-formulated peptide nutrition."
    content_angles:
      - angle_id: "HAIR-A1"
        name: "The Follicle Science"
        platform_priority: ["linkedin", "youtube", "instagram_carousel"]
        visual_style: "Higienlabs clean laboratory breakdown, micro-camera scalp shots"
      - angle_id: "HAIR-A2"
        name: "The 90-Day Transformation"
        platform_priority: ["tiktok", "instagram_reels", "facebook"]
        visual_style: "Daily morning routine, dropper application, density tracking"

# ------------------------------------------------------------------------------
# PRODUCT 3: HIGIENLABS ADVANCED SKIN CARE & BARRIER REPAIR (EXPANSION PIPELINE)
# Status: Formulation Phase (Higienlabs R&D)
# ------------------------------------------------------------------------------
  - id: "prod_higienlabs_skincare"
    name: "Higienlabs Dermo-Barrier Restoration Complex"
    items:
      - name: "Higienlabs Multi-Ceramide Repair Cream"
        volume: "100ml"
        form: "Lipid-rich barrier cream"
      - name: "Higienlabs Active Hyaluronic Recovery Mist"
        volume: "120ml"
        form: "Ultra-fine hydrating spray"
    category: "Cosmeceutical Skin Barrier Science"
    lab_angle: "Engineered by Higienlabs to rebuild the skin's lipid matrix against UV, pollution, and severe moisture loss."
    retail_endpoints:
      takealot: "https://www.takealot.com/higienlabs-skincare"
      direct_higiene: "https://higiene.co.za/higienlabs/skincare"
      shopify: "https://shop.higiene.co.za/skincare"
    target_audiences:
      - segment: "Sensitive & Reactive Skin Types"
        pain_points: ["Compromised skin barrier", "Stinging from ordinary moisturizers", "Redness and flare-ups"]
        hook: "Stop treating symptoms. Rebuild your skin's natural lipid defense."
    content_angles:
      - angle_id: "SKIN-A1"
        name: "Barrier Science Explained"
        platform_priority: ["linkedin", "youtube", "instagram"]
        visual_style: "Clinical aesthetic, dermatological diagrams, lab purity"

# ==============================================================================
# AUTOMATED PLATFORM EXECUTION MATRIX
# ==============================================================================
platform_rules:
  tiktok:
    ratio: "9:16"
    duration_max_secs: 30
    style: "Raw UGC creator hook, fast cut scenes, text overlays, trending background sound."
    cta: "Tap link in bio to order on Takealot / Fungusnomore.co.za"

  instagram:
    reels_ratio: "9:16"
    feed_ratio: "1:1"
    carousel_slides: 5
    style: "Aesthetic lifestyle, fitness routines, before/after stories, carousel education."
    cta: "Shop now via link in bio | Next-day delivery across South Africa."

  facebook:
    ratio: "1:1 and 9:16"
    style: "Direct-response ad with clear headline, customer review overlay, Takealot trust badge."
    cta: "Order today on Takealot or get bundle savings at Fungusnomore.co.za"

  youtube:
    bumper_ratio: "16:9"
    shorts_ratio: "9:16"
    bumper_duration_secs: 10
    style: "Rapid high-impact 10-second non-skippable pre-roll. Hook 0-2s, Proof 3-7s, CTA 8-10s."
    cta: "Shop Now on Takealot & Fungusnomore.co.za"

  linkedin:
    ratio: "16:9 or Document Carousel"
    style: "Higienlabs technology division innovation, founder insights by Vernon la Cock, formulation chemistry, pharmacy & retail distribution."
    cta: "Learn more about Higiene's manufacturing & lab developments at Higiene.co.za"
