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
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import MediaLibraryPage from './pages/MediaLibrary';
import Billing          from './pages/Billing';
import { Campaigns }    from './pages/Campaigns';

import AppLayout from './components/layout/AppLayout';
import PrivateRoute from './components/common/PrivateRoute';

const App: React.FC = () => {
    return (
        <Provider store={store}>
            <Router>
                <Toaster position="top-right" />
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard"  element={<Dashboard />} />
                        <Route path="studio"     element={<ContentStudio />} />
                        <Route path="scheduler"  element={<Scheduler />} />
                        <Route path="analytics"  element={<Analytics />} />
                        <Route path="campaigns"  element={<Campaigns />} />
                        <Route path="settings"   element={<Settings />} />
                        <Route path="media"      element={<MediaLibraryPage />} />
                        <Route path="billing"    element={<Billing />} />
                    </Route>
                </Routes>
            </Router>
        </Provider>
    );
};

export default App;
