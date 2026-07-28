import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, MapPin, List, Play, RefreshCw,
    Users, Phone, Mail, Globe, Sparkles, Sliders, Settings,
    Loader2, Star, Check, Copy, ExternalLink, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

interface ScrapeTask {
    id: string;
    query: string;
    location: string;
    limit_count: number;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    created_at: string;
}

interface ScrapedLead {
    id: string;
    business_name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    category?: string;
    rating?: number | string;
    reviews_count?: number | string;
    website?: string;
    competitor_rating?: number | string;
    created_at: string;
}

interface AutomationWorkflow {
    id: string;
    name: string;
    trigger_type: string;
    is_active: boolean;
    steps: any;
    created_at: string;
}

export const LeadScraper: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'leads' | 'tasks' | 'workflow'>('leads');
    const [tasks, setTasks] = useState<ScrapeTask[]>([]);
    const [leads, setLeads] = useState<ScrapedLead[]>([]);
    const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
    
    // Loading states
    const [loadingLeads, setLoadingLeads] = useState(false);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [loadingWorkflows, setLoadingWorkflows] = useState(false);
    const [scraping, setScraping] = useState(false);

    // Search input state
    const [query, setQuery] = useState('');
    const [location, setLocation] = useState('');
    const [limit, setLimit] = useState(20);
    const [searchTerm, setSearchTerm] = useState('');

    // Clipboard copy helpers
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const fetchLeads = async () => {
        setLoadingLeads(true);
        try {
            const { data } = await api.get('/automations/leads');
            setLeads(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Failed to load scraped leads');
            setLeads([]);
        } finally {
            setLoadingLeads(false);
        }
    };

    const fetchTasks = async () => {
        setLoadingTasks(true);
        try {
            const { data } = await api.get('/automations/tasks');
            setTasks(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Failed to load scraper tasks');
            setTasks([]);
        } finally {
            setLoadingTasks(false);
        }
    };

    const fetchWorkflows = async () => {
        setLoadingWorkflows(true);
        try {
            const { data } = await api.get('/automations/workflows');
            setWorkflows(Array.isArray(data) ? data : []);
        } catch {
            toast.error('Failed to load B2B workflows');
            setWorkflows([]);
        } finally {
            setLoadingWorkflows(false);
        }
    };

    useEffect(() => {
        fetchLeads();
        fetchTasks();
        fetchWorkflows();
    }, []);

    // Polling effect for active tasks
    useEffect(() => {
        if (!Array.isArray(tasks)) return;
        const activeTasksExist = tasks.some(t => t && (t.status === 'PENDING' || t.status === 'RUNNING'));
        if (!activeTasksExist) return;

        const interval = setInterval(async () => {
            try {
                const { data: newTasks } = await api.get('/automations/tasks');
                if (Array.isArray(newTasks)) {
                    setTasks(newTasks);
                    const someFinished = newTasks.some((nt: ScrapeTask) => {
                        const oldT = tasks.find(ot => ot && ot.id === nt.id);
                        return oldT && (oldT.status === 'PENDING' || oldT.status === 'RUNNING') && (nt.status === 'COMPLETED' || nt.status === 'FAILED');
                    });
                    
                    if (someFinished) {
                        fetchLeads();
                        toast.success('Lead scraping task finished!');
                    }
                }
            } catch (err) {
                console.error('Failed to poll tasks status:', err);
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [tasks]);

    const handleScrape = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || !location.trim()) {
            toast.error('Query and location are required');
            return;
        }

        setScraping(true);
        const toastId = toast.loading('Initializing B2B lead hunting...');
        try {
            await api.post('/automations/scrape', {
                query: query.trim(),
                location: location.trim(),
                limit
            });
            toast.success('Scraping task queued successfully! Results will populate shortly.', { id: toastId });
            setQuery('');
            setLocation('');
            fetchTasks();
            setActiveTab('tasks');
        } catch {
            toast.error('Failed to trigger scraping task', { id: toastId });
        } finally {
            setScraping(false);
        }
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success('Copied!');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const filteredLeads = Array.isArray(leads) ? leads.filter(l => {
        if (!l) return false;
        const term = (searchTerm || '').toLowerCase();
        const bName = (l.business_name || '').toLowerCase();
        const email = (l.email || '').toLowerCase();
        const phone = (l.phone || '');
        const category = (l.category || '').toLowerCase();
        const city = (l.city || '').toLowerCase();
        return (
            bName.includes(term) ||
            email.includes(term) ||
            phone.includes(term) ||
            category.includes(term) ||
            city.includes(term)
        );
    }) : [];

    const getStatusStyle = (status?: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
            case 'RUNNING': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'COMPLETED': return 'bg-green-50 text-green-700 border-green-200';
            case 'FAILED': return 'bg-red-50 text-red-700 border-red-200';
            default: return 'bg-gray-50 text-gray-700 border-gray-200';
        }
    };

    const safeParseRating = (val?: number | string): string | null => {
        if (val === undefined || val === null || val === '') return null;
        const num = Number(val);
        return isNaN(num) ? null : num.toFixed(1);
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                        <Search className="h-8 w-8 text-indigo-600 animate-pulse" />
                        B2B Lead Scraper
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm md:text-base">
                        Extract business leads from Google Maps using Outscraper & trigger automated outreach flows.
                    </p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            fetchLeads();
                            fetchTasks();
                            fetchWorkflows();
                        }}
                        className="p-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 shadow-sm transition"
                        title="Refresh Data"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Search Panel */}
                <div className="lg:col-span-1 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 self-start">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                        <Sparkles className="h-5 w-5 text-indigo-500" />
                        <h2 className="text-base font-bold text-gray-900">Lead Hunting</h2>
                    </div>

                    <form onSubmit={handleScrape} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Business Type / Keyword</label>
                            <div className="relative">
                                <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Epoxy Flooring, Roofers"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Location / City</label>
                            <div className="relative">
                                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Austin, Pretoria"
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Max Lead Limit</label>
                            <select
                                value={limit}
                                onChange={e => setLimit(parseInt(e.target.value))}
                                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value={10}>10 Leads (Instant)</option>
                                <option value={20}>20 Leads (Standard)</option>
                                <option value={50}>50 Leads (Thorough)</option>
                                <option value={100}>100 Leads (Deep Extraction)</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={scraping}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition disabled:opacity-50"
                        >
                            {scraping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                            Start B2B Lead Hunting
                        </button>
                    </form>
                </div>

                {/* Dashboard Tabs & Results */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Tabs */}
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-6" aria-label="Scraper tabs">
                            <button
                                onClick={() => setActiveTab('leads')}
                                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
                                    activeTab === 'leads'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Users className="h-4 w-4" />
                                Scraped Leads ({filteredLeads.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
                                    activeTab === 'tasks'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <List className="h-4 w-4" />
                                Active Tasks ({Array.isArray(tasks) ? tasks.length : 0})
                            </button>
                            <button
                                onClick={() => setActiveTab('workflow')}
                                className={`py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition ${
                                    activeTab === 'workflow'
                                        ? 'border-indigo-500 text-indigo-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <Sliders className="h-4 w-4" />
                                Outreach Settings
                            </button>
                        </nav>
                    </div>

                    {/* Leads Tab Content */}
                    {activeTab === 'leads' && (
                        <div className="space-y-4">
                            {/* Search bar */}
                            <input
                                type="text"
                                placeholder="Search leads by name, email, phone, city..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm text-sm"
                            />

                            {/* Table */}
                            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                                        <thead className="bg-gray-50 text-gray-700 uppercase text-[10px] font-bold tracking-wider">
                                            <tr>
                                                <th className="px-5 py-3">Business Name</th>
                                                <th className="px-5 py-3">Rating / Reviews</th>
                                                <th className="px-5 py-3">Contact</th>
                                                <th className="px-5 py-3">Address & City</th>
                                                <th className="px-5 py-3">Links</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 text-gray-900">
                                            {loadingLeads ? (
                                                <tr>
                                                    <td colSpan={5} className="px-5 py-16 text-center text-gray-400">
                                                        <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto mb-2" />
                                                        Loading scraped leads...
                                                    </td>
                                                </tr>
                                            ) : filteredLeads.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-5 py-16 text-center text-gray-400">
                                                        No scraped leads found. Fill out the Hunting form on the left to pull leads.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredLeads.map((lead) => {
                                                    const ratingStr = safeParseRating(lead.rating);
                                                    return (
                                                        <tr key={lead.id} className="hover:bg-gray-50 transition">
                                                            <td className="px-5 py-4">
                                                                <div className="font-bold text-gray-900">{lead.business_name || 'Unnamed Business'}</div>
                                                                {lead.category && (
                                                                    <span className="inline-block mt-1 text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                                                                        {lead.category}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                {ratingStr ? (
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                                                                            <Star className="h-3.5 w-3.5 fill-amber-500" />
                                                                            {ratingStr}
                                                                        </div>
                                                                        <div className="text-[10px] text-gray-400 font-medium">
                                                                            {lead.reviews_count || 0} reviews
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-400 italic">No ratings</span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-4 space-y-1">
                                                                {lead.email ? (
                                                                    <div className="flex items-center gap-1.5 group">
                                                                        <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                                                        <span className="text-xs text-gray-700 truncate max-w-[150px]">{lead.email}</span>
                                                                        <button
                                                                            onClick={() => copyToClipboard(lead.email!, `em-${lead.id}`)}
                                                                            className="text-gray-400 hover:text-indigo-600 transition shrink-0"
                                                                        >
                                                                            {copiedId === `em-${lead.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                                {lead.phone ? (
                                                                    <div className="flex items-center gap-1.5">
                                                                        <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                                                        <span className="text-xs text-gray-700 font-medium">{lead.phone}</span>
                                                                        <button
                                                                            onClick={() => copyToClipboard(lead.phone!, `ph-${lead.id}`)}
                                                                            className="text-gray-400 hover:text-indigo-600 transition shrink-0"
                                                                        >
                                                                            {copiedId === `ph-${lead.id}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                                                        </button>
                                                                    </div>
                                                                ) : null}
                                                                {!lead.email && !lead.phone && (
                                                                    <span className="text-gray-400 italic text-xs">No contact details</span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                <div className="text-xs text-gray-700 max-w-[180px] line-clamp-2">{lead.address}</div>
                                                                {lead.city && (
                                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-1">
                                                                        {lead.city}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-5 py-4">
                                                                {lead.website ? (
                                                                    <a
                                                                        href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 border border-gray-200 rounded-lg text-xs text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition font-medium"
                                                                    >
                                                                        <Globe className="h-3.5 w-3.5" />
                                                                        Site
                                                                        <ExternalLink className="h-2.5 w-2.5" />
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-gray-400 italic text-xs">None</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tasks Tab Content */}
                    {activeTab === 'tasks' && (
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
                                <thead className="bg-gray-50 text-gray-700 uppercase text-[10px] font-bold tracking-wider">
                                    <tr>
                                        <th className="px-5 py-3">Task Details</th>
                                        <th className="px-5 py-3">Region</th>
                                        <th className="px-5 py-3">Limit</th>
                                        <th className="px-5 py-3">Status</th>
                                        <th className="px-5 py-3">Run Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-gray-900">
                                    {loadingTasks && Array.isArray(tasks) && tasks.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                                                <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
                                            </td>
                                        </tr>
                                    ) : (!Array.isArray(tasks) || tasks.length === 0) ? (
                                        <tr>
                                            <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                                                No tasks triggered yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        tasks.map((task) => (
                                            <tr key={task.id} className="hover:bg-gray-50 transition">
                                                <td className="px-5 py-4">
                                                    <div className="font-bold text-gray-800">Scrape: "{task.query}"</div>
                                                    <div className="text-[10px] text-gray-400 mt-0.5">
                                                        ID: {task.id ? String(task.id).substring(0, 8) : 'N/A'}...
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 font-medium">{task.location}</td>
                                                <td className="px-5 py-4 font-bold text-gray-700">{task.limit_count}</td>
                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusStyle(task.status)}`}>
                                                        {task.status === 'RUNNING' && <Loader2 className="h-3 w-3 animate-spin" />}
                                                        {task.status}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-xs text-gray-500">
                                                    {task.created_at ? new Date(task.created_at).toLocaleString() : 'N/A'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Workflow settings tab */}
                    {activeTab === 'workflow' && (
                        <div className="space-y-6">
                            {/* Workflow configuration explanation */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 border-b border-gray-100 pb-3">
                                    <Settings className="h-5 w-5 text-purple-600" />
                                    Lead Ingestion Workflow Sequence
                                </h3>
                                <p className="text-xs text-gray-500">
                                    When the B2B Scraper successfully finds a business with contact information, it triggers the active lead-ingestion workflow. Below is the default automation workflow configured on your account.
                                </p>

                                {loadingWorkflows ? (
                                    <div className="py-8 text-center text-gray-400">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-purple-600" />
                                    </div>
                                ) : (!Array.isArray(workflows) || workflows.length === 0) ? (
                                    <div className="p-4 bg-amber-50 text-amber-700 text-xs border border-amber-200 rounded-xl flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                        No active ingestion workflow configured. Scraped leads will be saved as general contacts in your database but no outreach messages will fire.
                                    </div>
                                ) : (
                                    <div className="relative border-l-2 border-purple-100 pl-6 ml-3 space-y-5">
                                        {(() => {
                                            const workflow = workflows[0];
                                            if (!workflow) return null;
                                            let stepsList: any[] = [];
                                            try {
                                                if (typeof workflow.steps === 'string') {
                                                    stepsList = JSON.parse(workflow.steps);
                                                } else if (Array.isArray(workflow.steps)) {
                                                    stepsList = workflow.steps;
                                                }
                                            } catch (e) {
                                                console.error('Error parsing steps:', e);
                                            }

                                            return stepsList.map((step: any, idx: number) => (
                                                <div key={step.id || idx} className="relative">
                                                    {/* Bullet number */}
                                                    <span className="absolute -left-[35px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-purple-600 text-[10px] font-black text-white">
                                                        {idx + 1}
                                                    </span>
                                                    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-gray-800">{step.label}</span>
                                                            <span className="text-[9px] uppercase tracking-wider bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                                                                {step.type}
                                                            </span>
                                                        </div>
                                                        
                                                        {/* Step details display */}
                                                        {step.tag && (
                                                            <p className="text-xs text-gray-500">Apply tag: <span className="font-mono text-purple-600 font-bold">{step.tag}</span></p>
                                                        )}
                                                        {step.stage && (
                                                            <p className="text-xs text-gray-500">Pipeline stage: <span className="font-semibold text-gray-700">{step.stage}</span></p>
                                                        )}
                                                        {step.aiPrompt && (
                                                            <p className="text-xs text-purple-700 bg-purple-50 p-2 rounded-lg italic font-medium">
                                                                Prompt: "{step.aiPrompt}"
                                                            </p>
                                                        )}
                                                        {step.delayValue && (
                                                            <p className="text-xs text-gray-500">Delay: {step.delayValue} {step.delayUnit}</p>
                                                        )}
                                                        {step.emailSubject && (
                                                            <div className="bg-white p-2 rounded border border-gray-200 text-[11px] space-y-1">
                                                                <div className="font-bold text-gray-600">Subject: {step.emailSubject}</div>
                                                                <div className="text-gray-400 italic">"{step.emailBody}"</div>
                                                            </div>
                                                        )}
                                                        {step.smsBody && (
                                                            <div className="bg-white p-2 rounded border border-gray-200 text-[11px] text-gray-400 italic">
                                                                "{step.smsBody}"
                                                            </div>
                                                        )}
                                                        {step.whatsappBody && (
                                                            <div className="bg-white p-2 rounded border border-gray-200 text-[11px] text-gray-400 italic">
                                                                "{step.whatsappBody}"
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeadScraper;
