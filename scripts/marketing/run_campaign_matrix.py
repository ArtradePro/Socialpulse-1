#!/usr/bin/env python3
# ==============================================================================
# Script: run_campaign_matrix.py
# Entity: Higiene (Pty) Ltd — Higienlabs Technology Division
# Purpose: Autonomous engine that parses campaign_matrix.md and generates
#          multi-platform social copy, video scripts, and retail conversion links
#          for SocialPulse automation.
# ==============================================================================

import os
import sys
import yaml
import json
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MATRIX_PATH = os.path.join(REPO_ROOT, "campaign_matrix.md")
OUTPUT_DIR = os.path.join(REPO_ROOT, "docs", "marketing", "generated_campaigns")

def parse_campaign_matrix():
    if not os.path.isfile(MATRIX_PATH):
        raise FileNotFoundError(f"campaign_matrix.md not found at {MATRIX_PATH}")

    with open(MATRIX_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Split frontmatter / yaml if present or parse YAML blocks
    try:
        data = yaml.safe_load(content)
        if isinstance(data, dict) and "products" in data:
            return data
    except Exception:
        pass

    # Extract YAML block between markdown
    lines = content.splitlines()
    yaml_lines = []
    in_yaml = False
    for line in lines:
        if line.strip().startswith("brand_governance:"):
            in_yaml = True
        if in_yaml:
            yaml_lines.append(line)

    yaml_text = "\n".join(yaml_lines)
    return yaml.safe_load(yaml_text)

def generate_campaign_batch():
    matrix = parse_campaign_matrix()
    products = matrix.get("products", [])
    platforms = matrix.get("platform_rules", {})
    governance = matrix.get("brand_governance", {})

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_file = os.path.join(OUTPUT_DIR, f"campaign_batch_{timestamp}.json")

    batch = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "parent_company": governance.get("parent_company", "Higiene (Pty) Ltd"),
        "division": governance.get("rd_division", "Higienlabs Technology Division"),
        "total_products": len(products),
        "campaigns": []
    }

    for prod in products:
        prod_id = prod.get("id")
        prod_name = prod.get("name")
        slogan = prod.get("slogan", "")
        endpoints = prod.get("retail_endpoints", {})
        angles = prod.get("content_angles", [])

        prod_campaign = {
            "product_id": prod_id,
            "product_name": prod_name,
            "slogan": slogan,
            "retail_links": endpoints,
            "platform_assets": {}
        }

        # 1. TikTok 9:16 Video Script
        takealot_link = endpoints.get("takealot", "https://takealot.com")
        direct_link = endpoints.get("direct_fnm") or endpoints.get("direct_higiene", "https://higiene.co.za")

        slogan_display = slogan if slogan else "Science-backed care."
        prod_campaign["platform_assets"]["tiktok"] = {
            "format": "9:16 Vertical Video (UGC Creator)",
            "hook": f"Stop scrolling if you're dealing with stubborn irritation after the gym.",
            "script": (
                f"[SCENE 1: Locker room / bathroom close-up]\n"
                f"Creator: 'If you work out or wear sneakers all day, ordinary body wash does nothing against sweat bacteria.'\n"
                f"[SCENE 2: Holding {prod_name}]\n"
                f"Creator: 'This is {prod_name}. Step 1 is the Shower Gel that washes it clean. Step 2 is the Active Spray that protects you for 24 hours.'\n"
                f"[SCENE 3: Happy creator / product box]\n"
                f"Creator: '{slogan_display} Grab the duo bundle on Takealot with next-day delivery — link in bio!'"
            ),
            "caption": f"Never let gym sweat or stubborn irritation hold you back 💪 Grab {prod_name} on Takealot now! #GymHygiene #SkinCare #TakealotFinds #HigieneLabs",
            "destination_url": takealot_link
        }

        # 2. Instagram Carousel & Reel
        prod_campaign["platform_assets"]["instagram"] = {
            "format": "1:1 Carousel (5 Slides) + 9:16 Reel",
            "carousel_slides": [
                {"slide": 1, "title": "Why Normal Soap Fails Against Sweat Fungus", "text": "Standard soaps only clean surface oil, leaving moisture-loving bacteria behind."},
                {"slide": 2, "title": "The Dual-Action Solution", "text": f"{prod_name} was engineered by Higienlabs to wash and shield in two steps."},
                {"slide": 3, "title": "Step 1: Shower Gel (500ml)", "text": "Deeply washes away accumulated bacteria and neutralizes odor."},
                {"slide": 4, "title": "Step 2: Active Spray (50ml)", "text": "Fast-drying leave-on barrier that keeps feet and skin fresh all day."},
                {"slide": 5, "title": "Available Now Across South Africa", "text": f"Order on Takealot or get 2-pack and 3-bottle bundle savings at {direct_link}."}
            ],
            "caption": f"Your daily defense against stubborn sweat and irritation. Formulated by Higienlabs. {slogan} Link in bio to order with next-day delivery. 🛒✨",
            "destination_url": direct_link
        }

        # 3. Facebook Direct Response Ad
        prod_campaign["platform_assets"]["facebook"] = {
            "format": "1:1 Direct-Response Image Ad + 9:16 Story",
            "headline": f"Tired of Stubborn Itch & Foot Odor? | {prod_name}",
            "primary_text": (
                f"Active lifestyle? 10+ hours in work shoes? Ordinary soap washes the surface, but doesn't protect against sweat bacteria.\n\n"
                f"Meet {prod_name} by Higienlabs:\n"
                f"✅ Dual-Action Shower Gel + Spray Duo\n"
                f"✅ Eliminates odor and soothes irritation from Day 1\n"
                f"✅ Fast next-day delivery across South Africa on Takealot\n\n"
                f"{slogan if slogan else ''}\n"
                f"👉 Tap 'Shop Now' to claim your bundle on Takealot!"
            ),
            "call_to_action": "SHOP_NOW",
            "destination_url": takealot_link
        }

        # 4. YouTube 10s Bumper Ad
        prod_campaign["platform_assets"]["youtube"] = {
            "format": "16:9 Non-Skippable 10-Second Bumper",
            "duration_secs": 10,
            "voiceover": f"Stubborn sweat itch that won't quit? {prod_name} washes away odor and locks in 24-hour defense. {slogan} Tap Shop Now on Takealot!",
            "asset_references": {
                "hero_image": "docs/marketing/assets/fnm_youtube_hero_ad.jpg",
                "end_card": "docs/marketing/assets/fnm_youtube_end_card.jpg"
            },
            "destination_url": takealot_link
        }

        # 5. LinkedIn Higienlabs Innovation Post
        prod_campaign["platform_assets"]["linkedin"] = {
            "format": "Article / Image Thought Leadership",
            "headline": f"Formulation Integrity in Modern Cosmeceuticals: How Higienlabs is Solving Everyday Skin Health",
            "body": (
                f"At Higiene (Pty) Ltd, our Higienlabs Technology Division was founded on a singular premise: consumer hygiene should be backed by rigorous formulation science.\n\n"
                f"From our flagship {prod_name} line to our upcoming developments in Hair Growth and Dermo-Barrier Restoration, we focus on active bioavailability, rapid relief, and multi-channel accessibility across Takealot, Amazon, and direct platforms.\n\n"
                f"Proud to see our manufacturing and lab initiatives scale across South Africa.\n\n"
                f"#Biotech #Cosmeceuticals #Higienlabs #Manufacturing #SouthAfrica #SkinCare"
            ),
            "destination_url": "https://higiene.co.za"
        }

        batch["campaigns"].append(prod_campaign)

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(batch, f, indent=2)

    print(f"Successfully generated autonomous campaign batch: {out_file}")
    print(f"Generated assets for {len(products)} products across 5 platforms.")
    return out_file

if __name__ == "__main__":
    generate_campaign_batch()
