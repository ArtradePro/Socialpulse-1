# 14. E-commerce Integration

SocialPulse connects directly to your online store so you can turn product listings into high-converting social posts in seconds — without copy-pasting a single thing.

## 1. Supported Platforms
Connect any combination of the following stores to a workspace:

| Platform | Authentication |
| :--- | :--- |
| **Shopify** | API Key + Secret + Store URL |
| **WooCommerce** | Consumer Key + Consumer Secret + Store URL |
| **Amazon** | Seller ID + MWS Access Key + Secret Key |
| **Takealot** | API Key + Seller ID |

Each workspace can have multiple stores connected simultaneously (e.g., a Shopify store and a WooCommerce store side by side).

## 2. Connecting a Store
1. Navigate to **Workspace Settings → E-commerce**.
2. Click **"Connect Store"**.
3. Select your platform and enter the required credentials.
4. SocialPulse immediately runs an **initial product sync** to import your catalogue.
5. The store card shows the connection status (`active` / `error`) and the timestamp of the last sync.

> **Credentials are stored securely and never exposed in the UI after the initial save.**

## 3. Syncing Products
* **Automatic**: Stores sync periodically in the background to keep your product catalogue up to date.
* **Manual**: Click **"Sync Now"** on any store card to trigger an immediate refresh.
* **Conflict resolution**: If a product already exists (matched by `external_id`), its title, description, price, image, and tags are updated. No duplicates are created.

## 4. Browsing Your Product Catalogue
Go to **E-commerce → Products** to browse all synced products from all connected stores.
* **Search**: Filter by title or description keyword.
* **Pagination**: 20 products per page by default.
* Each product card shows the **title, price, currency, category, image**, and the originating store.

## 5. Generating a Product Post
This is where e-commerce meets AI.

1. Click **"Generate Post"** on any product card.
2. Select the **target platform** (Twitter, Instagram, LinkedIn, Facebook).
3. Select the **tone** (Promotional, Conversational, Luxury, etc.).
4. The AI reads the product's title, description, price, image URL, and your workspace's brand guidelines to write a ready-to-publish post.
5. The post is pre-loaded into the **Content Studio** with the product image already attached — ready to schedule or publish immediately.
6. Your workspace's **Purchase URL** (shortened automatically) is woven into the generated copy.

**API endpoint**: `POST /api/ai/product-post`
```json
{
  "productData": {
    "title": "Pro Running Shoes",
    "description": "Lightweight carbon-fibre sole...",
    "price": 149.99,
    "currency": "USD",
    "imageUrl": "https://...",
    "productUrl": "https://..."
  },
  "platform": "instagram",
  "tone": "Promotional"
}
```

## 6. API Reference
All e-commerce routes require authentication (`Authorization: Bearer <token>`) and the `X-Workspace-Id` header.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/ecommerce/stores` | List all connected stores for the active workspace |
| `POST` | `/api/ecommerce/stores` | Connect a new store — body: `{ platform, name, apiUrl, apiKey, apiSecret, sellerId }` |
| `DELETE` | `/api/ecommerce/stores/:id` | Disconnect a store (removes store + all synced products) |
| `POST` | `/api/ecommerce/stores/:id/sync` | Trigger a manual product sync |
| `GET` | `/api/ecommerce/products` | Browse synced products — query: `?search=&page=&limit=` |

---
**← [13. Cheat Sheets](./13_Platform_Cheat_Sheets.md)** | **[Index](../SOCIALPULSE_MANUAL.md)**
