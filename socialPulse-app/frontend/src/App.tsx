import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { Toaster } from 'react-hot-toast';

import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Dashboard } from './pages/Dashboard';
import { ContentStudio } from './pages/ContentStudio';
import { Scheduler } from './pages/Scheduler';
import Analytics from "./pages/Analytics";
import { Settings } from './pages/Settings';
import MediaLibraryPage from './pages/MediaLibrary';
import Billing           from './pages/Billing';
import { Campaigns }    from './pages/Campaigns';
import HashtagSets      from './pages/HashtagSets';
import Templates       from './pages/Templates';
import AcceptInvite    from './pages/AcceptInvite';
import { RssFeeds }       from './pages/RssFeeds';
import { ApiKeys }        from './pages/ApiKeys';
import { ImageGenerator } from './pages/ImageGenerator';
import { SocialListening } from './pages/SocialListening';
import { UnifiedInbox }   from './pages/UnifiedInbox';
import { Referrals }      from './pages/Referrals';
import { ImageEditor }   from './pages/ImageEditor';
import { Workspaces }   from './pages/Workspaces';

import AppLayout from './components/layout/AppLayout';
import PrivateRoute from './components/common/PrivateRoute';
import { BrandProvider } from './contexts/BrandContext';

const App: React.FC = () => {
    return (
        <Provider store={store}>
            <BrandProvider>
            <Router>
                <Toaster position="top-right" />
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/team-invite/:token" element={<AcceptInvite />} />

                    {/* Private Dashboard Routes */}
                    <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard"  element={<Dashboard />} />
                        <Route path="studio"     element={<ContentStudio />} />
                        <Route path="scheduler"  element={<Scheduler />} />
                        <Route path="analytics"  element={<Analytics />} />
                        <Route path="campaigns"      element={<Campaigns />} />
                        <Route path="hashtag-sets"   element={<HashtagSets />} />
                        <Route path="templates"      element={<Templates />} />
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
                    </Route>

                    {/* NEW: Catch-all route. If path not found, go to login */}
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            </Router>
            </BrandProvider>
        </Provider>
    );
};

export default App;