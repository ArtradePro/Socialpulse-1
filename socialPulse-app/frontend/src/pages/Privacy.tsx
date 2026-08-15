import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowLeft, CheckCircle2, FileText, Database, UserCheck, Trash2 } from 'lucide-react';

export const Privacy: React.FC = () => {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col justify-between">
            {/* Header / Navbar */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 font-bold text-xl text-indigo-600 hover:text-indigo-700 transition">
                        <ShieldCheck className="h-6 w-6 text-indigo-600" />
                        <span>SocialPulse</span>
                    </Link>
                    <div className="flex items-center gap-4">
                        <Link 
                            to="/terms" 
                            className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
                        >
                            Terms of Service
                        </Link>
                        <Link 
                            to="/login" 
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Back to App
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-grow">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-10 space-y-8">
                    
                    {/* Page Title */}
                    <div className="border-b border-slate-100 pb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-full mb-3">
                            <Lock className="h-3.5 w-3.5" />
                            Data Protection & Privacy
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                            Privacy Policy
                        </h1>
                        <p className="text-sm text-slate-500 mt-2">
                            Effective Date: August 15, 2026 | Last Updated: August 15, 2026
                        </p>
                    </div>

                    {/* Policy Summary Banner */}
                    <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 sm:p-5 text-sm text-indigo-950 space-y-2">
                        <h3 className="font-bold flex items-center gap-2 text-indigo-900">
                            <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0" />
                            Our Privacy Commitment
                        </h3>
                        <p className="leading-relaxed">
                            At SocialPulse, we respect your privacy and are committed to safeguarding your personal data and social media tokens. We do not sell your personal data or third-party social account data to advertisers.
                        </p>
                    </div>

                    {/* Policy Sections */}
                    <div className="space-y-8 text-sm sm:text-base leading-relaxed text-slate-600">
                        
                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                1. Information We Collect
                            </h2>
                            <p>
                                We collect information you provide directly to us when registering an account, connecting third-party social accounts, or contacting support:
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong className="text-slate-800">Account Credentials:</strong> Full name, email address, password hash, company name, and subscription details.</li>
                                <li><strong className="text-slate-800">Social Account Authorization Data:</strong> OAuth authentication tokens, profile handles, avatar URLs, and account IDs provided when you authorize SocialPulse to connect to social platforms (TikTok, Meta, LinkedIn, X/Twitter, YouTube).</li>
                                <li><strong className="text-slate-800">Uploaded Media & Content:</strong> Videos, images, post copy, hashtags, and schedule metadata uploaded to SocialPulse for publishing.</li>
                                <li><strong className="text-slate-800">Performance Analytics Data:</strong> Aggregated view counts, likes, shares, comments, and engagement statistics fetched via official platform APIs.</li>
                            </ul>
                        </section>

                        {/* TikTok Specific Section */}
                        <section className="space-y-3 bg-slate-50 p-5 rounded-xl border border-slate-200">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-indigo-600 shrink-0" />
                                2. TikTok API Data Usage & Compliance
                            </h2>
                            <p className="text-slate-700">
                                SocialPulse complies with the <a href="https://developers.tiktok.com/doc/tiktok-developers-services-policy/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-semibold hover:underline">TikTok Developer Terms & API Services Policy</a>. When you connect your TikTok account to SocialPulse:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-600">
                                <li>We access only the explicit scopes authorized by you during OAuth authentication (such as `user.info.basic`, `video.publish`, and `video.list`).</li>
                                <li>TikTok OAuth tokens are encrypted at rest using industry-standard AES-256 encryption.</li>
                                <li>TikTok account data (such as video titles, analytics metrics, and basic profile handles) is used exclusively to display your account performance inside your SocialPulse dashboard and execute scheduled video uploads.</li>
                                <li>We <strong className="text-slate-900">never</strong> sell, transfer, or share TikTok user data or access tokens to any third-party ad networks, data brokers, or external entities.</li>
                            </ul>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Database className="h-5 w-5 text-indigo-600 shrink-0" />
                                3. How We Use Your Information
                            </h2>
                            <p>We use the data we collect to deliver, maintain, and optimize our Service:</p>
                            <ul className="list-disc pl-6 space-y-1">
                                <li>To authenticate your identity and maintain workspace security.</li>
                                <li>To schedule, render, and automatically publish posts and TikTok videos to your authorized social accounts.</li>
                                <li>To compile engagement analytics reports and audience growth metrics inside SocialPulse.</li>
                                <li>To communicate transaction receipts, product updates, and technical support responses.</li>
                                <li>To detect and prevent fraudulent activities, spam, and security breaches.</li>
                            </ul>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <UserCheck className="h-5 w-5 text-indigo-600 shrink-0" />
                                4. Data Sharing & Third-Party Service Providers
                            </h2>
                            <p>
                                We do not sell your personal information. We share data only with trusted infrastructure sub-processors essential to providing the Service:
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong className="text-slate-800">Cloud Infrastructure & Hosting:</strong> Secure cloud providers hosting our database and backend APIs with strict encryption.</li>
                                <li><strong className="text-slate-800">Payment Processors:</strong> Stripe for secure payment handling. We do not store full credit card details on our servers.</li>
                                <li><strong className="text-slate-800">Official Social Media APIs:</strong> Direct API transmissions to TikTok, Meta, LinkedIn, X, and YouTube to publish your content as directed by you.</li>
                            </ul>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Trash2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                5. Data Retention, Disconnection & Data Deletion Rights
                            </h2>
                            <p>
                                You have complete control over your data and connected social media accounts:
                            </p>
                            <ul className="list-disc pl-6 space-y-2">
                                <li><strong className="text-slate-800">Disconnecting Accounts:</strong> You can disconnect your TikTok or other social media accounts at any time via Settings &gt; Social Accounts. Disconnecting immediately revokes our API access token and deletes stored access tokens.</li>
                                <li><strong className="text-slate-800">Account Deletion Request:</strong> You may request full account and data deletion by emailing <a href="mailto:privacy@usesocialpulse.com" className="text-indigo-600 hover:underline">privacy@usesocialpulse.com</a>. Upon request, all user data, connected social tokens, uploaded media, and draft posts will be permanently purged within 30 days.</li>
                                <li><strong className="text-slate-800">GDPR & CCPA Rights:</strong> Users in the EU, UK, and California have the right to access, rectify, port, or request erasure of their personal data held by SocialPulse.</li>
                            </ul>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                6. Cookies & Local Storage
                            </h2>
                            <p>
                                SocialPulse uses essential HTTP cookies and browser Local Storage to maintain active login sessions, security tokens, and user workspace preferences. We do not use third-party tracking cookies for cross-site advertising.
                            </p>
                        </section>

                        <section className="space-y-3 border-t border-slate-100 pt-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                7. Contact Privacy Officer
                            </h2>
                            <p>
                                For any questions regarding this Privacy Policy, your data rights, or TikTok API compliance, please contact our Data Protection Officer at:
                            </p>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm font-medium space-y-1">
                                <p className="text-slate-900 font-bold">SocialPulse Data Privacy Team</p>
                                <p className="text-slate-600">Privacy Contact: <a href="mailto:privacy@usesocialpulse.com" className="text-indigo-600 hover:underline">privacy@usesocialpulse.com</a></p>
                                <p className="text-slate-600">General Support: <a href="mailto:support@usesocialpulse.com" className="text-indigo-600 hover:underline">support@usesocialpulse.com</a></p>
                                <p className="text-slate-600">Website: <a href="https://usesocialpulse.com" className="text-indigo-600 hover:underline">https://usesocialpulse.com</a></p>
                            </div>
                        </section>

                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
                <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p>© {new Date().getFullYear()} SocialPulse. All rights reserved.</p>
                    <div className="flex items-center gap-4">
                        <Link to="/terms" className="hover:text-slate-800 font-medium">Terms of Service</Link>
                        <span>•</span>
                        <Link to="/privacy" className="hover:text-slate-800 font-medium">Privacy Policy</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Privacy;
