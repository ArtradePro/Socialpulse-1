import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, FileText, ArrowLeft, CheckCircle2 } from 'lucide-react';

export const Terms: React.FC = () => {
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
                            to="/privacy" 
                            className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition"
                        >
                            Privacy Policy
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
                            <FileText className="h-3.5 w-3.5" />
                            Legal Documentation
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                            Terms of Service
                        </h1>
                        <p className="text-sm text-slate-500 mt-2">
                            Effective Date: August 15, 2026 | Last Updated: August 15, 2026
                        </p>
                    </div>

                    {/* Terms Sections */}
                    <div className="space-y-8 text-sm sm:text-base leading-relaxed text-slate-600">
                        
                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                1. Acceptance of Terms
                            </h2>
                            <p>
                                Welcome to SocialPulse ("Company," "we," "us," or "our"). By accessing or using our platform, web application located at <span className="font-semibold text-slate-800">usesocialpulse.com</span>, mobile services, or associated APIs (collectively, the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Service.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                2. Description of Service
                            </h2>
                            <p>
                                SocialPulse provides an all-in-one social media management, content scheduling, audience analytics, and automated marketing platform. Our Service enables users to connect their social media accounts (including TikTok, Meta/Facebook/Instagram, LinkedIn, X/Twitter, and YouTube) to draft, schedule, publish content, analyze post performance, and automate B2B outreach workflows.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                3. Third-Party Platform Integrations & TikTok API Compliance
                            </h2>
                            <p>
                                SocialPulse integrates with third-party social networking platforms via their official Developer APIs. By connecting your social accounts to SocialPulse:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 text-slate-600">
                                <li>You grant SocialPulse permission to access authorized account features, post content on your behalf, and fetch analytics metrics in accordance with your chosen permissions.</li>
                                <li>You agree to comply with the respective Terms of Service and Community Guidelines of connected platforms, including the <a href="https://www.tiktok.com/legal/page/global/terms-of-service/en" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">TikTok Terms of Service</a>, Meta Platform Terms, and YouTube Terms of Service.</li>
                                <li>You acknowledge that SocialPulse does not control third-party platforms and is not responsible for outages, API policy changes, or actions taken by third-party platforms against your connected accounts.</li>
                            </ul>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                4. Account Registration & Security
                            </h2>
                            <p>
                                To access most features of the Service, you must register for an account. You agree to provide accurate, current, and complete registration details and maintain the security of your password and authentication credentials. You accept full responsibility for all activities that occur under your account.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                5. User Content & Acceptable Use
                            </h2>
                            <p>
                                You retain full ownership of all text, images, videos, audio, and media assets ("User Content") you upload or publish via SocialPulse. By submitting content through our Service, you grant us a worldwide, non-exclusive, royalty-free license to host, process, format, and transmit your content solely for the purpose of operating the Service for you.
                            </p>
                            <p className="font-semibold text-slate-800">You agree NOT to use SocialPulse to:</p>
                            <ul className="list-disc pl-6 space-y-1 text-slate-600">
                                <li>Publish or transmit unlawful, harassing, defamatory, obscene, or fraudulent content.</li>
                                <li>Violate copyright, trademark, or intellectual property rights of any party.</li>
                                <li>Send unauthorized spam, unsolicited commercial SMS/emails, or bulk automated messages in violation of applicable laws (such as CAN-SPAM, TCPA, or GDPR).</li>
                                <li>Attempt to gain unauthorized access to the Service, server infrastructure, or other user accounts.</li>
                            </ul>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                6. Subscriptions, Payments & Cancellations
                            </h2>
                            <p>
                                Certain features of SocialPulse are offered under paid subscription plans or credit packages. All fees are billed in advance on a recurring monthly or annual basis. You may cancel your subscription at any time through your Billing Settings. Subscription cancellations take effect at the end of the current billing cycle.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                7. Termination
                            </h2>
                            <p>
                                We reserve the right to suspend or terminate your access to the Service at any time, with or without notice, if we reasonably determine that you have violated these Terms or engaged in unauthorized use of third-party APIs. Upon termination, your right to use the Service will immediately cease.
                            </p>
                        </section>

                        <section className="space-y-3">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                8. Limitation of Liability
                            </h2>
                            <p>
                                To the maximum extent permitted by applicable law, SocialPulse and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising out of your access to or inability to access the Service.
                            </p>
                        </section>

                        <section className="space-y-3 border-t border-slate-100 pt-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-indigo-600 shrink-0" />
                                9. Contact Us
                            </h2>
                            <p>
                                If you have any questions or concerns regarding these Terms of Service, please contact our legal team at:
                            </p>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm font-medium space-y-1">
                                <p className="text-slate-900 font-bold">SocialPulse Legal & Support</p>
                                <p className="text-slate-600">Email: <a href="mailto:support@usesocialpulse.com" className="text-indigo-600 hover:underline">support@usesocialpulse.com</a></p>
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

export default Terms;
