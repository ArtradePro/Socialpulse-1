import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Plus, Trash2, Mail, Smartphone, Send, Users, Upload, 
    RefreshCw, BarChart2, Info, CheckCircle, AlertCircle, Calendar, Sparkles, Zap, CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface Contact {
    id: string;
    email: string;
    phone: string | null;
    first_name: string | null;
    last_name: string | null;
    is_subscribed_email: boolean;
    is_subscribed_sms: boolean;
    created_at: string;
}

interface Campaign {
    id: string;
    name: string;
    type: 'email' | 'sms';
    subject_line: string | null;
    body_content: string;
    status: 'draft' | 'scheduled' | 'sending' | 'completed';
    scheduled_at: string | null;
    created_at: string;
    total_sent?: string;
    total_delivered?: string;
    total_opened?: string;
    total_bounced?: string;
    total_failed?: string;
}

interface AnalyticsSummary {
    sendVolume: number;
    deliveryRate: number;
    openRate: number;
    bounceRate: number;
    rawMetrics: {
        sent: number;
        delivered: number;
        opened: number;
        clicked: number;
        bounced: number;
        failed: number;
    };
}

export const Marketing: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'contacts' | 'campaigns' | 'analytics'>('contacts');
    
    // Contacts state
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [contactsLoading, setContactsLoading] = useState(false);
    const [contactsTotal, setContactsTotal] = useState(0);
    const [contactsPage, setContactsPage] = useState(1);
    const [contactsSearch, setContactsSearch] = useState('');
    const [isAddContactOpen, setIsAddContactOpen] = useState(false);
    
    // Contact form state
    const [newContact, setNewContact] = useState({
        email: '',
        phone: '',
        firstName: '',
        lastName: '',
        isSubscribedEmail: true,
        isSubscribedSms: true
    });

    // Campaigns state
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [campaignsLoading, setCampaignsLoading] = useState(false);
    const [isAddCampaignOpen, setIsAddCampaignOpen] = useState(false);
    
    // Campaign form state
    const [newCampaign, setNewCampaign] = useState({
        name: '',
        type: 'email' as 'email' | 'sms',
        subjectLine: '',
        bodyContent: '',
        scheduledAt: ''
    });

    // Analytics state
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // Fetch lists
    const fetchContacts = async () => {
        setContactsLoading(true);
        try {
            const { data } = await api.get('/marketing/contacts', {
                params: {
                    page: contactsPage,
                    limit: 20,
                    search: contactsSearch
                }
            });
            setContacts(data.contacts);
            setContactsTotal(data.total);
        } catch (err) {
            toast.error('Failed to load contacts');
        } finally {
            setContactsLoading(false);
        }
    };

    const fetchCampaigns = async () => {
        setCampaignsLoading(true);
        try {
            const { data } = await api.get('/marketing/campaigns');
            setCampaigns(data.campaigns);
        } catch (err) {
            toast.error('Failed to load campaigns');
        } finally {
            setCampaignsLoading(false);
        }
    };

    const fetchAnalytics = async () => {
        setAnalyticsLoading(true);
        try {
            const { data } = await api.get('/marketing/analytics');
            setAnalytics(data);
        } catch (err) {
            toast.error('Failed to load analytics summary');
        } finally {
            setAnalyticsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'contacts') fetchContacts();
        if (activeTab === 'campaigns') fetchCampaigns();
        if (activeTab === 'analytics') fetchAnalytics();
    }, [activeTab, contactsPage, contactsSearch]);

    // Handle Contact CRUD
    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newContact.email) {
            toast.error('Email is required');
            return;
        }

        const toastId = toast.loading('Adding contact...');
        try {
            await api.post('/marketing/contacts', newContact);
            toast.success('Contact added successfully', { id: toastId });
            setIsAddContactOpen(false);
            setNewContact({
                email: '',
                phone: '',
                firstName: '',
                lastName: '',
                isSubscribedEmail: true,
                isSubscribedSms: true
            });
            fetchContacts();
        } catch (err) {
            toast.error('Failed to add contact', { id: toastId });
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;
        try {
            await api.delete(`/marketing/contacts/${id}`);
            toast.success('Contact deleted');
            fetchContacts();
        } catch (err) {
            toast.error('Failed to delete contact');
        }
    };

    // Bulk Import CSV
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target?.result as string;
            if (!text) return;

            const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
            if (lines.length < 2) {
                toast.error('CSV file is empty or missing data rows');
                return;
            }

            // Simple parsing: assumes header is "email,phone,first_name,last_name"
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
            
            const emailIdx = headers.indexOf('email');
            const phoneIdx = headers.indexOf('phone');
            const firstNameIdx = headers.indexOf('first_name') !== -1 ? headers.indexOf('first_name') : headers.indexOf('firstname');
            const lastNameIdx = headers.indexOf('last_name') !== -1 ? headers.indexOf('last_name') : headers.indexOf('lastname');

            if (emailIdx === -1) {
                toast.error('CSV must contain an "email" header column');
                return;
            }

            const parsedContacts: any[] = [];
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
                if (cols.length < headers.length) continue;
                
                parsedContacts.push({
                    email: cols[emailIdx],
                    phone: phoneIdx !== -1 ? cols[phoneIdx] : null,
                    firstName: firstNameIdx !== -1 ? cols[firstNameIdx] : null,
                    lastName: lastNameIdx !== -1 ? cols[lastNameIdx] : null,
                    isSubscribedEmail: true,
                    isSubscribedSms: true
                });
            }

            if (parsedContacts.length === 0) {
                toast.error('No valid contacts found in CSV');
                return;
            }

            const toastId = toast.loading(`Importing ${parsedContacts.length} contacts...`);
            try {
                const { data } = await api.post('/marketing/contacts/bulk', { contacts: parsedContacts });
                toast.success(`Successfully imported ${data.count} contacts!`, { id: toastId });
                fetchContacts();
            } catch (err) {
                toast.error('Bulk import failed', { id: toastId });
            }
        };

        reader.readAsText(file);
        // Reset file input value
        e.target.value = '';
    };

    // Handle Campaign creation
    const handleAddCampaign = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCampaign.name || !newCampaign.bodyContent) {
            toast.error('Campaign Name and Body are required');
            return;
        }

        const toastId = toast.loading('Creating campaign...');
        try {
            await api.post('/marketing/campaigns', {
                name: newCampaign.name,
                type: newCampaign.type,
                subjectLine: newCampaign.type === 'email' ? newCampaign.subjectLine : undefined,
                bodyContent: newCampaign.bodyContent,
                scheduledAt: newCampaign.scheduledAt ? new Date(newCampaign.scheduledAt).toISOString() : undefined
            });

            toast.success(newCampaign.scheduledAt ? 'Campaign scheduled successfully!' : 'Campaign created as draft', { id: toastId });
            setIsAddCampaignOpen(false);
            setNewCampaign({
                name: '',
                type: 'email',
                subjectLine: '',
                bodyContent: '',
                scheduledAt: ''
            });
            fetchCampaigns();
        } catch (err) {
            toast.error('Failed to create campaign', { id: toastId });
        }
    };

    const handleDeleteCampaign = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this campaign?')) return;
        try {
            await api.delete(`/marketing/campaigns/${id}`);
            toast.success('Campaign deleted');
            fetchCampaigns();
        } catch (err) {
            toast.error('Failed to delete campaign');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                        <Mail className="h-8 w-8 text-indigo-600" />
                        Omnichannel Marketing
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm md:text-base">
                        Orchestrate email newsletters & SMS broadcasts natively in your workspaces.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/marketing/automations')}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                    >
                        <Zap className="h-4 w-4" />
                        Automations
                    </button>
                    <button
                        onClick={() => navigate('/marketing/plans')}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                    >
                        <CreditCard className="h-4 w-4" />
                        Plans
                    </button>
                    {activeTab === 'contacts' && (
                        <>
                            <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer shadow-sm transition">
                                <Upload className="h-4 w-4 text-gray-500" />
                                Import CSV
                                <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                            </label>
                            <button 
                                onClick={() => setIsAddContactOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                            >
                                <Plus className="h-4 w-4" />
                                Add Contact
                            </button>
                        </>
                    )}
                    {activeTab === 'campaigns' && (
                        <button 
                            onClick={() => setIsAddCampaignOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                        >
                            <Plus className="h-4 w-4" />
                            Create Broadcast
                        </button>
                    )}
                    <button 
                        onClick={() => {
                            if (activeTab === 'contacts') fetchContacts();
                            if (activeTab === 'campaigns') fetchCampaigns();
                            if (activeTab === 'analytics') fetchAnalytics();
                        }}
                        className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 shadow-sm transition"
                        title="Refresh"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('contacts')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
                            activeTab === 'contacts'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <Users className="h-4 w-4" />
                        Contacts ({contactsTotal})
                    </button>
                    <button
                        onClick={() => setActiveTab('campaigns')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
                            activeTab === 'campaigns'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <Send className="h-4 w-4" />
                        Campaigns
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
                            activeTab === 'analytics'
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                        <BarChart2 className="h-4 w-4" />
                        Analytics
                    </button>
                </nav>
            </div>

            {/* TAB CONTENT: CONTACTS */}
            {activeTab === 'contacts' && (
                <div className="space-y-4">
                    {/* Search / Filter */}
                    <div className="flex">
                        <input
                            type="text"
                            placeholder="Search email, name..."
                            value={contactsSearch}
                            onChange={(e) => {
                                setContactsSearch(e.target.value);
                                setContactsPage(1);
                            }}
                            className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Name</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Phone</th>
                                        <th className="px-6 py-4">Email Sub</th>
                                        <th className="px-6 py-4">SMS Sub</th>
                                        <th className="px-6 py-4">Created At</th>
                                        <th className="px-6 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-gray-900">
                                    {contactsLoading ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                                <div className="flex items-center justify-center gap-2">
                                                    <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
                                                    Loading contacts...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : contacts.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                                No contacts found. Click "Add Contact" or "Import CSV" to populate list.
                                            </td>
                                        </tr>
                                    ) : (
                                        contacts.map((contact) => (
                                            <tr key={contact.id} className="hover:bg-gray-50 transition">
                                                <td className="px-6 py-4 font-medium">
                                                    {contact.first_name || contact.last_name
                                                        ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim()
                                                        : <span className="text-gray-400 italic">No name</span>
                                                    }
                                                </td>
                                                <td className="px-6 py-4">{contact.email}</td>
                                                <td className="px-6 py-4">{contact.phone || <span className="text-gray-400 italic">—</span>}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                        contact.is_subscribed_email ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {contact.is_subscribed_email ? 'Subscribed' : 'Unsubscribed'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                        contact.is_subscribed_sms ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {contact.is_subscribed_sms ? 'Subscribed' : 'Unsubscribed'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {new Date(contact.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button 
                                                        onClick={() => handleDeleteContact(contact.id)}
                                                        className="text-red-500 hover:text-red-700 transition"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                                Showing {contacts.length} of {contactsTotal} contacts
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setContactsPage(p => Math.max(1, p - 1))}
                                    disabled={contactsPage === 1}
                                    className="px-3 py-1 border border-gray-300 rounded-md text-xs bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setContactsPage(p => p + 1)}
                                    disabled={contacts.length < 20}
                                    className="px-3 py-1 border border-gray-300 rounded-md text-xs bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: CAMPAIGNS */}
            {activeTab === 'campaigns' && (
                <div className="space-y-6">
                    {campaignsLoading && campaigns.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
                            Loading campaigns...
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl bg-white p-8">
                            <Send className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">No campaigns created</h3>
                            <p className="text-gray-500 mt-1 max-w-sm mx-auto text-sm">
                                Create and launch your first email newsletter or SMS blast to connect with subscribers.
                            </p>
                            <button
                                onClick={() => setIsAddCampaignOpen(true)}
                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition"
                            >
                                <Plus className="h-4 w-4" />
                                Create Campaign
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {campaigns.map((campaign) => (
                                <div key={campaign.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                campaign.type === 'email' ? 'bg-indigo-100 text-indigo-800' : 'bg-sky-100 text-sky-800'
                                            }`}>
                                                {campaign.type === 'email' ? <Mail className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
                                                {campaign.type.toUpperCase()}
                                            </span>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                                campaign.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                                campaign.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                                            </span>
                                        </div>

                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">{campaign.name}</h3>
                                            {campaign.type === 'email' && campaign.subject_line && (
                                                <p className="text-xs text-gray-400 mt-0.5">Subject: {campaign.subject_line}</p>
                                            )}
                                        </div>

                                        <p className="text-sm text-gray-600 line-clamp-3 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
                                            "{campaign.body_content}"
                                        </p>
                                        
                                        {/* Status Delivery Bars */}
                                        {campaign.status !== 'draft' && (
                                            <div className="grid grid-cols-4 gap-2 text-center text-xs border-t border-gray-100 pt-3">
                                                <div className="bg-indigo-50 p-2 rounded">
                                                    <span className="block font-bold text-indigo-700">{campaign.total_sent || 0}</span>
                                                    <span className="text-[10px] text-indigo-500 uppercase font-semibold">Sent</span>
                                                </div>
                                                <div className="bg-green-50 p-2 rounded">
                                                    <span className="block font-bold text-green-700">{campaign.total_delivered || 0}</span>
                                                    <span className="text-[10px] text-green-500 uppercase font-semibold">Deliv.</span>
                                                </div>
                                                {campaign.type === 'email' && (
                                                    <div className="bg-sky-50 p-2 rounded">
                                                        <span className="block font-bold text-sky-700">{campaign.total_opened || 0}</span>
                                                        <span className="text-[10px] text-sky-500 uppercase font-semibold">Open</span>
                                                    </div>
                                                )}
                                                <div className="bg-red-50 p-2 rounded">
                                                    <span className="block font-bold text-red-700">{Number(campaign.total_bounced || 0) + Number(campaign.total_failed || 0)}</span>
                                                    <span className="text-[10px] text-red-500 uppercase font-semibold">Bounce</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
                                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {campaign.scheduled_at 
                                                ? `Sends ${new Date(campaign.scheduled_at).toLocaleString()}` 
                                                : `Created ${new Date(campaign.created_at).toLocaleDateString()}`
                                            }
                                        </span>
                                        <button 
                                            onClick={() => handleDeleteCampaign(campaign.id)}
                                            className="text-red-500 hover:text-red-700 transition"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB CONTENT: ANALYTICS */}
            {activeTab === 'analytics' && (
                <div className="space-y-6">
                    {analyticsLoading ? (
                        <div className="text-center py-12 text-gray-400">
                            <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
                            Loading analytics...
                        </div>
                    ) : !analytics ? (
                        <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-xl">
                            No analytics data found. Launch a campaign to see statistics.
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Analytics Summary Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Volume</span>
                                    <div className="text-3xl font-extrabold text-gray-900 mt-2">{analytics.sendVolume}</div>
                                    <span className="text-[10px] text-gray-400 mt-1 block">Total messages dispatched</span>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Delivery Rate</span>
                                    <div className="text-3xl font-extrabold text-green-600 mt-2">{analytics.deliveryRate}%</div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                                        <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${analytics.deliveryRate}%` }}></div>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Open Rate (Email)</span>
                                    <div className="text-3xl font-extrabold text-indigo-600 mt-2">{analytics.openRate}%</div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${analytics.openRate}%` }}></div>
                                    </div>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bounce Rate</span>
                                    <div className="text-3xl font-extrabold text-red-600 mt-2">{analytics.bounceRate}%</div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-3">
                                        <div className="bg-red-500 h-1.5 rounded-full" style={{ width: `${analytics.bounceRate}%` }}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Delivery Funnel Detail */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
                                <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
                                    <BarChart2 className="h-5 w-5 text-indigo-600" />
                                    Delivery Funnel Breakdown
                                </h3>

                                <div className="space-y-4">
                                    {/* Sent */}
                                    <div>
                                        <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                                            <span>Sent / Dispatched</span>
                                            <span>{analytics.rawMetrics.sent}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                            <div className="bg-indigo-600 h-3 rounded-full" style={{ width: '100%' }}></div>
                                        </div>
                                    </div>

                                    {/* Delivered */}
                                    <div>
                                        <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                                            <span>Delivered</span>
                                            <span>{analytics.rawMetrics.delivered}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                            <div className="bg-green-500 h-3 rounded-full" style={{ 
                                                width: `${analytics.sendVolume > 0 ? (analytics.rawMetrics.delivered / analytics.sendVolume) * 100 : 0}%` 
                                            }}></div>
                                        </div>
                                    </div>

                                    {/* Opened */}
                                    <div>
                                        <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                                            <span>Opened</span>
                                            <span>{analytics.rawMetrics.opened}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                            <div className="bg-sky-400 h-3 rounded-full" style={{ 
                                                width: `${analytics.sendVolume > 0 ? (analytics.rawMetrics.opened / analytics.sendVolume) * 100 : 0}%` 
                                            }}></div>
                                        </div>
                                    </div>

                                    {/* Bounced */}
                                    <div>
                                        <div className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                                            <span>Bounced</span>
                                            <span>{analytics.rawMetrics.bounced}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3">
                                            <div className="bg-red-400 h-3 rounded-full" style={{ 
                                                width: `${analytics.sendVolume > 0 ? (analytics.rawMetrics.bounced / analytics.sendVolume) * 100 : 0}%` 
                                            }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODAL: ADD CONTACT */}
            {isAddContactOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Users className="h-5 w-5 text-indigo-600" />
                                Add Contact
                            </h3>
                            <button onClick={() => setIsAddContactOpen(false)} className="text-gray-500 hover:text-gray-700 text-xl font-bold">×</button>
                        </div>
                        <form onSubmit={handleAddContact} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">First Name</label>
                                <input
                                    type="text"
                                    placeholder="Jane"
                                    value={newContact.firstName}
                                    onChange={e => setNewContact({...newContact, firstName: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Last Name</label>
                                <input
                                    type="text"
                                    placeholder="Doe"
                                    value={newContact.lastName}
                                    onChange={e => setNewContact({...newContact, lastName: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email <span className="text-red-500">*</span></label>
                                <input
                                    type="email"
                                    placeholder="jane.doe@example.com"
                                    required
                                    value={newContact.email}
                                    onChange={e => setNewContact({...newContact, email: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone Number</label>
                                <input
                                    type="text"
                                    placeholder="+1234567890"
                                    value={newContact.phone}
                                    onChange={e => setNewContact({...newContact, phone: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                            </div>
                            
                            <div className="flex gap-4 border-t border-gray-100 pt-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={newContact.isSubscribedEmail}
                                        onChange={e => setNewContact({...newContact, isSubscribedEmail: e.target.checked})}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-gray-700 font-medium">Email Subscriber</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={newContact.isSubscribedSms}
                                        onChange={e => setNewContact({...newContact, isSubscribedSms: e.target.checked})}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-xs text-gray-700 font-medium">SMS Subscriber</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAddContactOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: CREATE CAMPAIGN */}
            {isAddCampaignOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-xl border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Send className="h-5 w-5 text-indigo-600" />
                                Create Marketing Campaign
                            </h3>
                            <button onClick={() => setIsAddCampaignOpen(false)} className="text-gray-500 hover:text-gray-700 text-xl font-bold">×</button>
                        </div>
                        <form onSubmit={handleAddCampaign} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Campaign Name <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="Summer Clearance Blast"
                                        required
                                        value={newCampaign.name}
                                        onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Broadcast Type</label>
                                    <select
                                        value={newCampaign.type}
                                        onChange={e => setNewCampaign({...newCampaign, type: e.target.value as 'email' | 'sms'})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                    >
                                        <option value="email">Email Newsletter</option>
                                        <option value="sms">SMS Broadcast</option>
                                    </select>
                                </div>
                            </div>

                            {newCampaign.type === 'email' && (
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Subject Line <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        placeholder="Get 40% off all catalog items this weekend only!"
                                        required={newCampaign.type === 'email'}
                                        value={newCampaign.subjectLine}
                                        onChange={e => setNewCampaign({...newCampaign, subjectLine: e.target.value})}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                    Message Body Content <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    placeholder={newCampaign.type === 'email' ? "<h1>Hello!</h1><p>Type your HTML/Text newsletter body here...</p>" : "Type your short SMS message body here..."}
                                    required
                                    rows={6}
                                    value={newCampaign.bodyContent}
                                    onChange={e => setNewCampaign({...newCampaign, bodyContent: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
                                />
                                <span className="text-[10px] text-gray-400 mt-1 block">
                                    {newCampaign.type === 'sms' 
                                        ? `Characters: ${newCampaign.bodyContent.length} (${Math.ceil(newCampaign.bodyContent.length / 160)} SMS segments)` 
                                        : 'HTML elements are supported for newsletters.'
                                    }
                                </span>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Calendar className="h-3.5 w-3.5" />
                                    Schedule Send Time (Optional)
                                </label>
                                <input
                                    type="datetime-local"
                                    value={newCampaign.scheduledAt}
                                    onChange={e => setNewCampaign({...newCampaign, scheduledAt: e.target.value})}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                />
                                <span className="text-[10px] text-gray-400 mt-1 block">
                                    Leave blank to create a draft. If set, campaign will automatically dispatch at the specified time.
                                </span>
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAddCampaignOpen(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm flex items-center gap-1.5"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    {newCampaign.scheduledAt ? 'Schedule Campaign' : 'Save Draft'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
