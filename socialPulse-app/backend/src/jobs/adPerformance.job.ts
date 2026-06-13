import cron from 'node-cron';
import { db } from '../config/database';

export const initAdPerformanceJob = (): void => {
    // Run every 1 minute to simulate real-time ad performance updates for active campaigns
    cron.schedule('*/1 * * * *', async () => {
        try {
            // Fetch all ACTIVE campaigns
            const { rows: campaigns } = await db.query(
                `SELECT * FROM ad_campaigns WHERE status = 'ACTIVE'`
            );

            for (const camp of campaigns) {
                const dailyBudget = parseFloat(camp.budget_amount);
                const isDaily = camp.budget_type === 'DAILY';
                
                // Spend increment: B / 1440 (1 day = 1440 min) or B / (7 * 1440) for lifetime
                const denom = isDaily ? 1440 : (7 * 1440);
                const spendInc = dailyBudget / denom;
                
                // CPM = $12 average
                const cpm = 12.00;
                // Impressions generated in 1 min
                const impressionsInc = Math.floor((spendInc / cpm) * 1000);
                
                if (impressionsInc <= 0) continue;

                // Click-through rate (CTR) = 1.0% - 2.0%
                const ctr = 0.01 + Math.random() * 0.01;
                const clicksInc = Math.round(impressionsInc * ctr);

                // Conversion rate (CVR) = 1.0% - 3.0%
                const cvr = 0.01 + Math.random() * 0.02;
                const conversionsInc = Math.round(clicksInc * cvr);

                // Update campaign stats
                await db.query(
                    `UPDATE ad_campaigns
                     SET spend = spend + $1,
                         impressions = impressions + $2,
                         clicks = clicks + $3,
                         conversions = conversions + $4,
                         updated_at = NOW()
                     WHERE id = $5`,
                    [spendInc, impressionsInc, clicksInc, conversionsInc, camp.id]
                );

                // If conversion occurs and target URL is a SocialPulse Sales Page, log a mock storefront purchase!
                if (conversionsInc > 0 && camp.target_url) {
                    const match = camp.target_url.match(/\/s\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) {
                        const slug = match[1];
                        const { rows: salesPages } = await db.query(
                            `SELECT id, price, currency FROM sales_pages WHERE slug = $1`,
                            [slug]
                        );
                        if (salesPages[0]) {
                            const page = salesPages[0];
                            const mockNames = ['Sarah Jenkins', 'Alice Smith', 'Bob Carter', 'Charlie Miller', 'Emily Watson'];
                            const mockEmails = ['sarah@example.com', 'alice.s@example.com', 'bob.c@example.com', 'charlie.m@example.com', 'emily.w@example.com'];
                            
                            for (let i = 0; i < conversionsInc; i++) {
                                const idx = Math.floor(Math.random() * mockNames.length);
                                const name = mockNames[idx];
                                const email = mockEmails[idx];
                                
                                // Insert mock sales order
                                await db.query(
                                    `INSERT INTO sales_orders (sales_page_id, customer_name, customer_email, amount, currency)
                                     VALUES ($1, $2, $3, $4, $5)`,
                                    [page.id, name, email, page.price, page.currency]
                                );

                                // Update sales page metrics
                                await db.query(
                                    `UPDATE sales_pages
                                     SET sales_count = sales_count + 1,
                                         revenue = revenue + $1
                                     WHERE id = $2`,
                                    [page.price, page.id]
                                );
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[AdPerformance] cron error:', err);
        }
    });

    console.log('Ad performance simulator job initialized');
};
