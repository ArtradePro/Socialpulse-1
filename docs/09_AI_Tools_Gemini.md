# 09. AI Tools (Gemini Integration)

At the heart of SocialPulse is our **Gemini 2.5 Flash AI Engine**. We don't just use AI to "write text"; we use it to build frameworks that sell.

## 1. AI Content Reviewer (The Revenue Engine)
This is the most powerful tool in the Content Studio. It uses the **Pain-Solution-CTA** framework to score your drafts.

### Example Review Response
```json
{
  "score": 85,
  "feedback": [
    { "component": "Hook",  "status": "pass", "message": "Strong — targets the 'time-poor agency owner' pain point." },
    { "component": "Proof", "status": "fail", "message": "Missing — add a client testimonial or data point." },
    { "component": "CTA",   "status": "pass", "message": "Direct — leads to the booking page." }
  ],
  "remix": "Struggling to keep up with social media? [Proof point]. SocialPulse automates it all → [Link]"
}
```

* **Framework Analysis**: Checks your post for a compelling hook (Pain), a clear offer (Promise), social proof, and a strong call to action (CTA). A score of 0–100 is returned.
* **One-Click Remix**: If your draft is weak, the AI returns a fully rewritten "Remix" version. Click "Apply" to instantly replace your post with the high-conversion version.
* **API endpoint**: `POST /api/ai/review` — body: `{ content, platform }`

## 2. AI Writer & Strategist
* **Content Generation**: Provide a topic, tone (Professional / Witty / Aggressive), length, language, optional target audience and keywords. The AI returns a ready-to-publish post plus hashtags.
  * **API endpoint**: `POST /api/ai/generate`
* **Hashtag Generator**: Supply a topic and platform to receive a curated list of hashtags.
  * **API endpoint**: `POST /api/ai/hashtags`
* **Improve Existing Post**: Select an improvement goal (e.g., "more engaging", "add urgency") and the AI rewrites the copy.
  * **API endpoint**: `POST /api/ai/improve`
* **Image Caption**: Describe an image and the AI writes a platform-optimised caption.
  * **API endpoint**: `POST /api/ai/caption`

## 3. Magic 7-Day Plan
Located in the **Campaigns** tab, this feature generates a complete multi-day content calendar in a single click.
* **Inputs**: Campaign name, optional description, and the number of days (default 7).
* **Output**: A sequenced series of posts across Twitter, LinkedIn, Instagram, and Facebook — mixing Educational, Engagement, Promotional, and Behind-the-Scenes content types.
* **Costs**: 7 AI credits per plan generated (one per post).
* **API endpoint**: `POST /api/ai/magic-plan`

## 4. AI Reply Generator (Unified Inbox)
When viewing a message or mention in the Unified Inbox, click **"AI Reply"** to instantly draft a context-aware response.
* The AI reads the incoming message, your workspace brand guidelines, and your configured purchase link to craft a relevant, concise reply.
* The reply is pre-loaded into the reply box for your review before sending.
* **API endpoint**: `POST /api/ai/reply` — body: `{ messageContent, platform }`

## 5. Trend-to-Post (Social Listening)
Spotted a trending topic in your **Social Listening** feed? Click **"Draft Post"** on any result.
* The AI reads the trend content and creates a platform-native post that joins the conversation — including your workspace purchase link if relevant.
* **API endpoint**: `POST /api/ai/draft-from-trend` — body: `{ trendContent, platform }`

## 6. Product Post Generator (E-commerce)
From the **E-commerce** section, select any synced product and click **"Generate Post"**.
* The AI uses the product title, description, price, and image URL to write a ready-to-schedule promotional post.
* Select the target platform and tone (Promotional / Conversational / Luxury) before generating.
* **API endpoint**: `POST /api/ai/product-post` — body: `{ productData, platform, tone }`

## 7. AI Image Generation (Imagen 4.0)
* **Prompt Example**:
  > "A professional product photo of @Image sitting on a warm wooden table, sunset lighting, high resolution."
* **Sizes**: 1024×1024, 1792×1024 (landscape), 1024×1792 (portrait).
* **Cost**: 2 AI credits per image.
* **Style & Branding Consistency (@Image Reference)**:
  * Users can select an existing photo from their Media Library to serve as a style, subject, or branding reference.
  * Click the **"Use @Image in prompt"** button in the generator panel to insert the `@Image` token into the prompt.
  * When the request is sent, **Gemini 2.5 Flash** first analyzes the reference image to extract detailed descriptive attributes (dimensions, text, logo placement, materials, colors, lighting).
  * The system automatically replaces the `@Image` token in the prompt with this detailed description (or appends it if the token is omitted) before sending it to **Imagen 4.0**.
  * This guarantees that generated visuals maintain high consistency with real-life product packaging or characters.
* **Integration**: Generated images can be downloaded, copied to clipboard, or saved directly to your Media Library for immediate use in posts.
* **API endpoint**: `POST /api/ai/image` — body: `{ prompt, size?, referenceImageUrl? }`

## 8. Smart Brand Guidelines & Product Knowledge
The AI is only as good as its instructions and knowledge. Configure these settings per workspace in **Workspace Settings → Branding**:
* **AI Brand Guidelines**: Set tone, style, formatting rules, or restrictions.
  * *Example*: "Never use the word 'hustle'. Always end with a question. Use British English spelling."
  * *Result*: The AI applies these rules to every post, reply, plan, and product post it drafts in this workspace — ensuring a consistent brand voice.
* **Product/Service Background Info (Facts & Benefits)**: Provide key product specifications, ingredients, timeframe, and unique selling points.
  * *Example (Fungus No More)*: "Organic oil spray. Kills 99.9% of nail fungus in 2 weeks. Uses natural tea tree oil, clinically proven, prevents recurrence."
  * *Result*: The AI pulls these facts to write highly accurate posts and campaigns. Additionally, the **AI Content Reviewer** uses this context to verify that drafts do not make false or unaligned claims.
* **Purchase URL + Link Shortener**: Set a `Purchase URL` in workspace settings. The platform automatically shortens it via the built-in link shortener and injects the short link into every AI-generated post, ad copy, and review.

---
**← [08. Analytics](./08_Analytics.md)** | **[Index](../SOCIALPULSE_MANUAL.md)** | **[Next: Media Library](./10_Media_Library.md) →**

