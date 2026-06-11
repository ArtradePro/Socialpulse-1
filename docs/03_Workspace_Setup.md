# 03. Workspace Setup & Branding

SocialPulse is built on a powerful multi-tenant architecture. **Workspaces** allow you to isolate data for different brands, departments, or clients while using a single login.

## 1. What is a Workspace?
A workspace is a completely isolated environment containing its own:
* Social Media Accounts
* Media Library
* Hashtag Sets
* Campaigns & Content
* RSS Feeds
* E-commerce Stores & Products
* Analytics Data

## 2. Creating & Managing Workspaces
* **Creating**: Click the Workspace Selector in the top navbar and select "Manage Workspaces" to add a new brand.
* **Switching**: Use the dropdown to jump between brands instantly. The entire UI will refresh to show data only for that specific brand.

## 3. High-Fidelity Branding Settings
Every workspace can be uniquely branded to reflect the corporate identity of the client or brand you are managing.
* **Brand Identity**: Upload a logo and set a display name.
* **UI Customization**: Set a "Brand Color" to personalize the interface (injected as a CSS variable across the UI).
* **Custom Domain**: Set a custom domain for the workspace's public-facing approval portal and brand pages.
* **AI Guidelines**: Provide the AI with specific instructions for this brand (e.g., "Always use emojis," "Tone: Professional but witty," "Never mention competitors"). The Gemini AI follows these rules for every post, reply, and plan it drafts in this workspace.
* **Purchase URL (Default CTA Link)**: Set a store or landing page URL. The platform automatically shortens it via the built-in link shortener and injects the short link into all AI-generated content. The AI Reviewer will also flag if your post is missing this link.

## 4. Built-in Link Shortener
When a `Purchase URL` is set on a workspace, SocialPulse automatically:
1. Generates a unique 8-character short code (e.g., `https://usesocialpulse.com/l/aB3xY7kQ`).
2. Reuses the same short code for the same URL (no duplicates).
3. Tracks click counts on every short link.
4. Injects the short link into every AI-generated post, magic plan, reply, and product post for that workspace.

## 5. Team Collaboration
* **Inviting Members**: Send email invitations to colleagues or clients.
* **Role-Based Access Control (RBAC)**:
  - **Owner**: Full access including billing.
  - **Admin**: Can manage settings, members, and all content.
  - **Member**: Can create and schedule content.
  - **Viewer**: Read-only access to analytics and scheduled posts (perfect for client review).

---
**← [02. Start](./02_Getting_Started.md)** | **[Index](../SOCIALPULSE_MANUAL.md)** | **[Next: Social Accounts](./04_Social_Accounts.md) →**

