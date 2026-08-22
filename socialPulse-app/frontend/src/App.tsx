import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { Toaster } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

// Public Critical Routes (Eagerly loaded for instant first paint)
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Home } from './pages/Home';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import AppLayout from './components/layout/AppLayout';
import PrivateRoute from './components/common/PrivateRoute';
import { BrandProvider } from './contexts/BrandContext';

// Dynamic Lazy Imports for Dashboard Subpages
const Dashboard        = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const ContentStudio    = lazy(() => import('./pages/ContentStudio').then(m => ({ default: m.ContentStudio })));
const Scheduler        = lazy(() => import('./pages/Scheduler').then(m => ({ default: m.Scheduler })));
const Analytics        = lazy(() => import('./pages/Analytics'));
const Settings         = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const MediaLibraryPage = lazy(() => import('./pages/MediaLibrary'));
const Billing          = lazy(() => import('./pages/Billing'));
const Campaigns        = lazy(() => import('./pages/Campaigns').then(m => ({ default: m.Campaigns })));
const HashtagSets      = lazy(() => import('./pages/HashtagSets'));
const Templates        = lazy(() => import('./pages/Templates'));
const AcceptInvite     = lazy(() => import('./pages/AcceptInvite'));
const RssFeeds         = lazy(() => import('./pages/RssFeeds').then(m => ({ default: m.RssFeeds })));
const ApiKeys          = lazy(() => import('./pages/ApiKeys').then(m => ({ default: m.ApiKeys })));
const ImageGenerator   = lazy(() => import('./pages/ImageGenerator').then(m => ({ default: m.ImageGenerator })));
const SocialListening  = lazy(() => import('./pages/SocialListening').then(m => ({ default: m.SocialListening })));
const UnifiedInbox     = lazy(() => import('./pages/UnifiedInbox').then(m => ({ default: m.UnifiedInbox })));
const Referrals        = lazy(() => import('./pages/Referrals').then(m => ({ default: m.Referrals })));
const ImageEditor      = lazy(() => import('./pages/ImageEditor').then(m => ({ default: m.ImageEditor })));
const Workspaces       = lazy(() => import('./pages/Workspaces').then(m => ({ default: m.Workspaces })));
const Ecommerce        = lazy(() => import('./pages/Ecommerce').then(m => ({ default: m.Ecommerce })));
const MagicPlan        = lazy(() => import('./pages/MagicPlan').then(m => ({ default: m.MagicPlan })));
const Storefront       = lazy(() => import('./pages/Storefront').then(m => ({ default: m.Storefront })));
const PublicStorefront = lazy(() => import('./pages/PublicStorefront').then(m => ({ default: m.PublicStorefront })));
const Ads              = lazy(() => import('./pages/Ads').then(m => ({ default: m.Ads })));
const Marketing        = lazy(() => import('./pages/Marketing').then(m => ({ default: m.Marketing })));
const Automations      = lazy(() => import('./pages/Automations').then(m => ({ default: m.Automations })));
const MarketingPlans   = lazy(() => import('./pages/MarketingPlans').then(m => ({ default: m.MarketingPlans })));
const LeadScraper      = lazy(() => import('./pages/LeadScraper').then(m => ({ default: m.LeadScraper })));
const ApprovalPortal   = lazy(() => import('./pages/ApprovalPortal').then(m => ({ default: m.ApprovalPortal })));

// Branded Page Loading Spinner
const PageLoader: React.FC = () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Loading SocialPulse...</p>
        </div>
    </div>
);

const App: React.FC = () => {
    return (
        <Provider store={store}>
            <BrandProvider>
            <Router>
                <Toaster position="top-right" />
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/terms" element={<Terms />} />
                        <Route path="/privacy" element={<Privacy />} />
                        <Route path="/team-invite/:token" element={<AcceptInvite />} />
                        <Route path="/approve/:token" element={<ApprovalPortal />} />
                        <Route path="/s/:slug" element={<PublicStorefront />} />

                        <Route path="/" element={<Home />} />

                        {/* Private Dashboard Routes */}
                        <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                            <Route path="dashboard"  element={<Dashboard />} />
                            <Route path="studio"     element={<ContentStudio />} />
                            <Route path="scheduler"  element={<Scheduler />} />
                            <Route path="analytics"  element={<Analytics />} />
                            <Route path="campaigns"      element={<Campaigns />} />
                            <Route path="hashtag-sets"   element={<HashtagSets />} />
                            <Route path="templates"      element={<Templates />} />
                            <Route path="template"       element={<Navigate to="/templates" replace />} />
                            <Route path="settings"   element={<Settings />} />
                            <Route path="media"      element={<MediaLibraryPage />} />
                            <Route path="billing"    element={<Billing />} />
                            <Route path="rss"        element={<RssFeeds />} />
                            <Route path="api-keys"   element={<ApiKeys />} />
                            <Route path="image-gen"  element={<ImageGenerator />} />
                            <Route path="listening"  element={<SocialListening />} />
                            <Route path="inbox"      element={<UnifiedInbox />} />
                            <Route path="referrals"    element={<Referrals />} />
                            <Route path="image-editor" element={<ImageEditor />} />
                            <Route path="workspaces"   element={<Workspaces />} />
                            <Route path="ecommerce"    element={<Ecommerce />} />
                            <Route path="magic-plan"   element={<MagicPlan />} />
                            <Route path="storefront"   element={<Storefront />} />
                            <Route path="ads"          element={<Ads />} />
                            <Route path="marketing"    element={<Marketing />} />
                            <Route path="marketing/scraper"     element={<LeadScraper />} />
                            <Route path="marketing/automations" element={<Automations />} />
                            <Route path="marketing/plans"       element={<MarketingPlans />} />
                        </Route>

                        {/* Catch-all route */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </Suspense>
            </Router>
            </BrandProvider>
        </Provider>
    );
};

export default App;