import React, { useState, useEffect, useRef } from 'react';
import { 
    Plus, Megaphone, BarChart2, FileText, Trash2, X, Calendar, 
    Loader2, ChevronRight, Wand2, Sparkles, Eye, ShoppingBag, 
    DollarSign, Percent, ExternalLink, Copy, Check, Info, Layers,
    User, Send, Mail, ShieldAlert, Award
} from 'lucide-react';
import toast from 'react-hot-toast';
import { storefrontService, SalesPage, SalesOrder } from '../services/storefrontService';
import { crmService, Customer, ChatMessage } from '../services/crmService';
import api from '../services/api';

interface Product {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    image_url: string;
    product_url: string;
    category: string;
}

export const Storefront: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'pages' | 'orders' | 'customers'>('pages');
    const [pages, setPages] = useState<SalesPage[]>([]);
    const [orders, setOrders] = useState<SalesOrder[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [selectedPage, setSelectedPage] = useState<SalesPage | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // CRM chat drawer states
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sendingMsg, setSendingMsg] = useState(false);
    const [loadingChat, setLoadingChat] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Form states
    const [title, setTitle] = useState('');
    const [productId, setProductId] = useState('');
    const [theme, setTheme] = useState<'modern' | 'dark-neon' | 'glassmorphism'>('modern');
    const [headline, setHeadline] = useState('');
    const [description, setDescription] = useState('');
    const [features, setFeatures] = useState<string[]>(['']);
    const [price, setPrice] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [imageUrl, setImageUrl] = useState('');
    const [ctaText, setCtaText] = useState('Buy Now');
    const [saving, setSaving] = useState(false);

    // Extended settings
    const [stripeSecretKey, setStripeSecretKey] = useState('');
    const [paypalClientId, setPaypalClientId] = useState('');
    const [useLivePayments, setUseLivePayments] = useState(false);
    const [metaPixelId, setMetaPixelId] = useState('');
    const [gtmId, setGtmId] = useState('');

    // A/B test settings
    const [isAbTest, setIsAbTest] = useState(false);
    const [variantTheme, setVariantTheme] = useState<'modern' | 'dark-neon' | 'glassmorphism'>('dark-neon');
    const [variantHeadline, setVariantHeadline] = useState('');
    const [variantDescription, setVariantDescription] = useState('');
    const [variantPrice, setVariantPrice] = useState('');

    const handleFeatureChange = (index: number, value: string) => {
        const updated = [...features];
        updated[index] = value;
        setFeatures(updated);
    };

    const addFeatureField = () => {
        setFeatures([...features, '']);
    };

    const removeFeatureField = (index: number) => {
        if (features.length <= 1) {
            setFeatures(['']);
            return;
        }
        setFeatures(features.filter((_, idx) => idx !== index));
    };

    // Form Navigation
    const [formSection, setFormSection] = useState<'basics' | 'abtest' | 'payments' | 'pixels'>('basics');

    useEffect(() => {
        fetchData();
    }, []);

    // Scroll chat messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Poll chat history if customer details drawer is active
    useEffect(() => {
        if (!selectedCustomer) return;
        const interval = setInterval(async () => {
            try {
                const res = await crmService.getCustomerMessages(selectedCustomer.id);
                setChatMessages(res.messages);
            } catch (err) {
                console.error('Failed to poll chat messages:', err);
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [selectedCustomer]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pagesRes, ordersRes, customersRes, productsRes] = await Promise.all([
                storefrontService.getPages(),
                storefrontService.getOrders(),
                crmService.getCustomers(),
                api.get('/ecommerce/products').catch(() => ({ data: { products: [] } }))
            ]);
            setPages(pagesRes);
            setOrders(ordersRes);
            setCustomers(customersRes);
            setProducts(productsRes.data?.products || []);
        } catch (err) {
            toast.error('Failed to load storefront data');
        } finally {
            setLoading(false);
        }
    };

    const handleProductChange = (prodId: string) => {
        setProductId(prodId);
        if (!prodId) return;
        const prod = products.find(p => p.id === prodId);
        if (prod) {
            setTitle(prod.title);
            setHeadline(`Get your ${prod.title} today!`);
            setDescription(prod.description || '');
            setPrice(prod.price.toString());
            setCurrency(prod.currency || 'USD');
            setImageUrl(prod.image_url || '');
            
            // Default A/B values
            setVariantHeadline(`Exclusive Offer: ${prod.title}!`);
            setVariantDescription(prod.description || '');
            setVariantPrice(prod.price.toString());
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !headline.trim() || !price) {
            toast.error('Please fill in all required fields');
            return;
        }

        setSaving(true);
        const activeFeatures = features.filter(f => f.trim() !== '');

        try {
            const pageData = {
                title,
                product_id: productId || null,
                theme,
                headline,
                description,
                features: activeFeatures,
                price: parseFloat(price),
                currency,
                image_url: imageUrl || null,
                cta_text: ctaText,
                stripe_secret_key: stripeSecretKey,
                paypal_client_id: paypalClientId,
                use_live_payments: useLivePayments,
                meta_pixel_id: metaPixelId,
                gtm_id: gtmId,
                is_ab_test: isAbTest,
                variant_theme: variantTheme,
                variant_headline: variantHeadline,
                variant_description: variantDescription,
                variant_price: variantPrice ? parseFloat(variantPrice) : null
            };

            if (selectedPage) {
                await storefrontService.updatePage(selectedPage.id, pageData);
                toast.success('Sales Page updated');
            } else {
                await storefrontService.createPage(pageData);
                toast.success('Sales Page generated!');
            }
            
            setShowCreate(false);
            resetForm();
            await fetchData();
        } catch (err) {
            toast.error('Failed to save Sales Page');
        } finally {
            setSaving(false);
        }
    };

    const openEditModal = (page: SalesPage) => {
        setSelectedPage(page);
        setTitle(page.title);
        setProductId(page.product_id || '');
        setTheme(page.theme);
        setHeadline(page.headline);
        setDescription(page.description || '');
        setFeatures(page.features.length > 0 ? page.features : ['']);
        setPrice(page.price.toString());
        setCurrency(page.currency);
        setImageUrl(page.image_url || '');
        setCtaText(page.cta_text || 'Buy Now');
        
        // Settings states
        setStripeSecretKey(page.stripe_secret_key || '');
        setPaypalClientId(page.paypal_client_id || '');
        setUseLivePayments(!!page.use_live_payments);
        setMetaPixelId(page.meta_pixel_id || '');
        setGtmId(page.gtm_id || '');
        
        // A/B test states
        setIsAbTest(!!page.is_ab_test);
        setVariantTheme(page.variant_theme || 'dark-neon');
        setVariantHeadline(page.variant_headline || '');
        setVariantDescription(page.variant_description || '');
        setVariantPrice(page.variant_price ? page.variant_price.toString() : '');

        setFormSection('basics');
        setShowCreate(true);
    };

    const copyToClipboard = (slug: string, id: string) => {
        const url = `${window.location.origin}/s/${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        toast.success('Sales Page URL copied to clipboard');
        setTimeout(() => setCopiedId(null), 2000);
    };

    const resetForm = () => {
        setSelectedPage(null);
        setTitle('');
        setProductId('');
        setTheme('modern');
        setHeadline('');
        setDescription('');
        setFeatures(['']);
        setPrice('');
        setCurrency('USD');
        setImageUrl('');
        setCtaText('Buy Now');
        
        setStripeSecretKey('');
        setPaypalClientId('');
        setUseLivePayments(false);
        setMetaPixelId('');
        setGtmId('');
        
        setIsAbTest(false);
        setVariantTheme('dark-neon');
        setVariantHeadline('');
        setVariantDescription('');
        setVariantPrice('');
        
        setFormSection('basics');
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this mobile sales page? This will also remove associated analytics.')) return;
        try {
            await storefrontService.deletePage(id);
            setPages(prev => prev.filter(p => p.id !== id));
            toast.success('Sales Page deleted');
        } catch {
            toast.error('Failed to delete page');
        }
    };

    // Chat Actions
    const handleOpenChat = async (customer: Customer) => {
        setSelectedCustomer(customer);
        setLoadingChat(true);
        try {
            const res = await crmService.getCustomerMessages(customer.id);
            setChatMessages(res.messages);
        } catch {
            toast.error('Failed to load chat history');
        } finally {
            setLoadingChat(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer || !newMessage.trim() || sendingMsg) return;

        setSendingMsg(true);
        try {
            const res = await crmService.sendCustomerMessage(selectedCustomer.id, newMessage);
            setChatMessages(prev => [...prev, res]);
            setNewMessage('');
            
            // Visual notice of incoming simulated customer reply
            setTimeout(async () => {
                try {
                    const poll = await crmService.getCustomerMessages(selectedCustomer.id);
                    setChatMessages(poll.messages);
                    toast('New reply from customer!', { icon: '💬' });
                } catch {}
            }, 3200);
        } catch {
            toast.error('Failed to transmit message');
        } finally {
            setSendingMsg(false);
        }
    };

    const handleSendReceipt = async () => {
        if (!selectedCustomer) return;
        try {
            const res = await crmService.sendEmailReceipt(selectedCustomer.id);
            setChatMessages(prev => [...prev, res.messageRecord]);
            toast.success(res.message);
        } catch {
            toast.error('Failed to dispatch receipt');
        }
    };

    // Metrics Calculations
    const totalViews = pages.reduce((acc, p) => acc + (p.visits || 0) + (p.variant_visits || 0), 0);
    const totalSales = pages.reduce((acc, p) => acc + (p.sales_count || 0) + (p.variant_sales_count || 0), 0);
    const totalRev = pages.reduce((acc, p) => acc + (p.revenue || 0) + (p.variant_revenue || 0), 0);
    const avgConvRate = totalViews > 0 ? ((totalSales / totalViews) * 100).toFixed(1) : '0.0';

    const renderABStats = (page: SalesPage) => {
        const aVisits = page.visits || 0;
        const aSales = page.sales_count || 0;
        const aRev = page.revenue || 0;
        const aCR = aVisits > 0 ? (aSales / aVisits) * 100 : 0;

        const bVisits = page.variant_visits || 0;
        const bSales = page.variant_sales_count || 0;
        const bRev = page.variant_revenue || 0;
        const bCR = bVisits > 0 ? (bSales / bVisits) * 100 : 0;

        const crDiff = Math.abs(aCR - bCR).toFixed(1);
        let winningText = '';
        if (aSales > 0 || bSales > 0) {
            if (aCR > bCR) {
                winningText = `Variant A (Control) is winning by +${crDiff}% Conversion Rate`;
            } else if (bCR > aCR) {
                winningText = `Variant B (Variant) is winning by +${crDiff}% Conversion Rate`;
            } else {
                winningText = `Variants are tied at ${aCR.toFixed(1)}% Conversion Rate`;
            }
        } else {
            winningText = 'A/B Testing active: waiting for checkout conversions...';
        }

        return (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-150 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" /> A/B split testing performance
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase">
                        Split Active
                    </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-xs">
                    {/* Variant A */}
                    <div className="p-3 bg-white border border-gray-100 rounded-lg">
                        <p className="font-bold text-gray-800">Variant A (Control)</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">Theme: {page.theme}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 font-medium text-gray-500">
                            <div>Visits: <span className="text-gray-900 font-bold">{aVisits}</span></div>
                            <div>Orders: <span className="text-gray-900 font-bold">{aSales}</span></div>
                            <div>CR: <span className="text-indigo-600 font-bold">{aCR.toFixed(1)}%</span></div>
                            <div>Revenue: <span className="text-emerald-600 font-bold">${aRev.toFixed(0)}</span></div>
                        </div>
                    </div>

                    {/* Variant B */}
                    <div className="p-3 bg-white border border-gray-100 rounded-lg">
                        <p className="font-bold text-gray-800">Variant B (Variant)</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 uppercase tracking-wide">Theme: {page.variant_theme}</p>
                        <div className="grid grid-cols-2 gap-2 mt-2 font-medium text-gray-500">
                            <div>Visits: <span className="text-gray-900 font-bold">{bVisits}</span></div>
                            <div>Orders: <span className="text-gray-900 font-bold">{bSales}</span></div>
                            <div>CR: <span className="text-indigo-600 font-bold">{bCR.toFixed(1)}%</span></div>
                            <div>Revenue: <span className="text-emerald-600 font-bold">${bRev.toFixed(0)}</span></div>
                        </div>
                    </div>
                </div>

                <div className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    {winningText}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6 select-none relative">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mobile Storefront</h1>
                    <p className="text-sm text-gray-500 mt-1">Generate landing pages, split-test variants & communicate with clients (Zeely-style)</p>
                </div>
                <button
                    onClick={() => { resetForm(); setShowCreate(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-violet-600 to-indigo-600 text-white rounded-xl font-medium hover:opacity-95 shadow-md shadow-indigo-600/20 active:scale-[0.98] transition-all"
                >
                    <Plus className="w-4 h-4" /> New Sales Page
                </button>
            </div>

            {/* Aggregated Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Page Views', value: totalViews.toLocaleString(), icon: Eye, color: 'text-blue-500 bg-blue-50' },
                    { label: 'Orders Placed', value: totalSales.toLocaleString(), icon: ShoppingBag, color: 'text-violet-500 bg-violet-50' },
                    { label: 'Revenue Generated', value: `$${totalRev.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500 bg-emerald-50' },
                    { label: 'Conv. Rate', value: `${avgConvRate}%`, icon: Percent, color: 'text-amber-500 bg-amber-50' },
                ].map(stat => (
                    <div key={stat.label} className="bg-white p-5 rounded-2xl border border-gray-200 flex items-center justify-between shadow-xs">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{stat.label}</p>
                            <p className="text-xl font-black text-gray-800 mt-1">{stat.value}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${stat.color}`}>
                            <stat.icon className="w-5 h-5" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('pages')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all ${
                        activeTab === 'pages'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Sales Pages ({pages.length})
                </button>
                <button
                    onClick={() => setActiveTab('orders')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all ${
                        activeTab === 'orders'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Orders Feed ({orders.length})
                </button>
                <button
                    onClick={() => setActiveTab('customers')}
                    className={`px-5 py-2.5 font-medium text-sm border-b-2 transition-all ${
                        activeTab === 'customers'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    Customers CRM ({customers.length})
                </button>
            </div>

            {/* Tab Contents */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : activeTab === 'pages' ? (
                pages.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                        <ShoppingBag className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No sales pages created yet</p>
                        <p className="text-gray-400 text-sm mt-1">Create a mobile product checkout page in seconds</p>
                        <button
                            onClick={() => { resetForm(); setShowCreate(true); }}
                            className="mt-4 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
                        >
                            Create first page
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {pages.map(page => (
                            <div
                                key={page.id}
                                onClick={() => openEditModal(page)}
                                className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between gap-4"
                            >
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-14 h-14 bg-gray-50 rounded-xl overflow-hidden border border-gray-100 flex-shrink-0 flex items-center justify-center">
                                            {page.image_url ? (
                                                <img src={page.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ShoppingBag className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-base font-bold text-gray-900 truncate">{page.title}</h2>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-linear-to-br from-indigo-50 to-purple-50 text-indigo-600 border border-indigo-100">
                                                    {page.theme}
                                                </span>
                                                {page.is_ab_test && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                                                        A/B TEST
                                                    </span>
                                                )}
                                                {page.use_live_payments && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                        Live Checkout
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1 truncate max-w-lg">{page.headline}</p>
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 font-medium">
                                                <span className="text-indigo-600 font-bold">{page.currency} {page.price}</span>
                                                <span>•</span>
                                                <span>{page.visits + (page.variant_visits || 0)} Total Views</span>
                                                <span>•</span>
                                                <span>{page.sales_count + (page.variant_sales_count || 0)} Total Sales</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 self-end md:self-center">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                copyToClipboard(page.slug, page.id);
                                            }}
                                            className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-500 transition-colors flex items-center gap-1 text-xs font-bold"
                                            title="Copy page link"
                                        >
                                            {copiedId === page.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            Link
                                        </button>
                                        <a
                                            href={`/s/${page.slug}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-gray-500 transition-colors flex items-center gap-1 text-xs font-bold"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            View
                                        </a>
                                        <button
                                            onClick={e => handleDelete(page.id, e)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {page.is_ab_test && renderABStats(page)}
                            </div>
                        ))}
                    </div>
                )
            ) : activeTab === 'orders' ? (
                orders.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                        <Layers className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No orders received yet</p>
                        <p className="text-gray-400 text-sm mt-1">Once visitors purchase on your sales pages, orders show here</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <th className="p-4">Customer</th>
                                    <th className="p-4">Sales Page</th>
                                    <th className="p-4">Amount</th>
                                    <th className="p-4">Split Variant</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-150 text-sm text-gray-700">
                                {orders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="p-4">
                                            <p className="font-semibold text-gray-900">{order.customer_name}</p>
                                            <p className="text-xs text-gray-400 font-medium">{order.customer_email}</p>
                                        </td>
                                        <td className="p-4">
                                            <p className="font-medium truncate max-w-[200px]">{order.sales_page_title}</p>
                                        </td>
                                        <td className="p-4 font-bold text-emerald-600">
                                            {order.currency} {order.amount}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                (order as any).variant_used === 'B' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                                            }`}>
                                                Variant {(order as any).variant_used || 'A'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase">
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-xs text-gray-400 font-medium">
                                            {new Date(order.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
            ) : customers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
                    <User className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No customer profiles yet</p>
                    <p className="text-gray-400 text-sm mt-1">Clients who place orders on storefronts will be logged as contacts</p>
                </div>
            ) : (
                /* CRM Customer List */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs h-[600px] flex flex-col">
                        <div className="p-4 border-b border-gray-150 bg-gray-50 font-bold text-xs uppercase tracking-wider text-gray-400">
                            Contacts List ({customers.length})
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-gray-150">
                            {customers.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => handleOpenChat(c)}
                                    className={`p-4 cursor-pointer hover:bg-indigo-50/20 transition-all flex items-center justify-between ${
                                        selectedCustomer?.id === c.id ? 'bg-indigo-50/40 border-l-4 border-indigo-600 pl-3' : ''
                                    }`}
                                >
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-800 truncate">{c.name}</p>
                                        <p className="text-xs text-gray-400 truncate mt-0.5">{c.email}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs h-[600px] flex flex-col">
                        {selectedCustomer ? (
                            <>
                                {/* Chat Header */}
                                <div className="p-4 border-b border-gray-150 bg-gray-50 flex items-center justify-between flex-shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                                            {selectedCustomer.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800 leading-tight">{selectedCustomer.name}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                                                Spent: ${selectedCustomer.total_spent} • Orders: {selectedCustomer.total_orders}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleSendReceipt}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-xs font-bold hover:bg-indigo-100 active:scale-[0.98] transition-all"
                                    >
                                        <Mail className="w-3.5 h-3.5" /> Email Receipt
                                    </button>
                                </div>

                                {/* Chat Logs */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/40">
                                    {loadingChat ? (
                                        <div className="flex justify-center items-center h-full">
                                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                                        </div>
                                    ) : (
                                        chatMessages.map(msg => {
                                            const isSystem = msg.message.startsWith('📧');
                                            const isUser = msg.sender === 'USER';
                                            return (
                                                <div 
                                                    key={msg.id} 
                                                    className={`flex ${isSystem ? 'justify-center' : isUser ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    {isSystem ? (
                                                        <div className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold text-center">
                                                            {msg.message}
                                                        </div>
                                                    ) : (
                                                        <div className={`max-w-[70%] px-3.5 py-2.5 rounded-2xl text-xs leading-normal ${
                                                            isUser 
                                                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                                                : 'bg-white text-gray-700 border border-gray-250 rounded-tl-none shadow-xs'
                                                        }`}>
                                                            {msg.message}
                                                            <p className={`text-[8px] mt-1.5 text-right font-medium ${isUser ? 'text-indigo-200' : 'text-gray-400'}`}>
                                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Send Input Form */}
                                <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-150 bg-white flex items-center gap-2 flex-shrink-0">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder={`Message ${selectedCustomer.name}...`}
                                        className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim() || sendingMsg}
                                        className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center"
                                    >
                                        {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col justify-center items-center text-center p-8">
                                <Layers className="w-12 h-12 text-gray-200 mb-3" />
                                <p className="text-gray-500 font-medium">Select a contact from the list</p>
                                <p className="text-gray-400 text-xs mt-1">Review correspondence logs and trigger receipt updates</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Creation Wizard Dialog */}
            {showCreate && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b border-gray-150">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">
                                    {selectedPage ? 'Edit Mobile Sales Page' : 'Generate AI Sales Page'}
                                </h2>
                                <p className="text-xs text-gray-400 font-medium">Configure visuals, split tests, and payment rails</p>
                            </div>
                            <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Section tabs inside the form modal */}
                        <div className="flex border-b border-gray-150 text-xs font-bold uppercase tracking-wider bg-gray-50 shrink-0">
                            {[
                                { key: 'basics', label: 'Layout Design' },
                                { key: 'abtest', label: 'A/B Testing' },
                                { key: 'payments', label: 'Payments' },
                                { key: 'pixels', label: 'Tracking' }
                            ].map(sect => (
                                <button
                                    key={sect.key}
                                    type="button"
                                    onClick={() => setFormSection(sect.key as any)}
                                    className={`flex-1 py-3 text-center border-b-2 transition-all ${
                                        formSection === sect.key
                                            ? 'border-indigo-600 text-indigo-600 bg-white'
                                            : 'border-transparent text-gray-400 hover:text-gray-650'
                                    }`}
                                >
                                    {sect.label}
                                </button>
                            ))}
                        </div>
                        
                        <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-6 space-y-5">
                            {formSection === 'basics' && (
                                <>
                                    {/* Product Selector */}
                                    {!selectedPage && products.length > 0 && (
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                                                Autofill from connected store product
                                            </label>
                                            <select
                                                value={productId}
                                                onChange={e => handleProductChange(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="">-- Or enter manually --</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Page Basics */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Page Title *</label>
                                            <input
                                                required
                                                type="text"
                                                value={title}
                                                onChange={e => setTitle(e.target.value)}
                                                placeholder="e.g. Leather Wallet Pro"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Theme Design</label>
                                            <select
                                                value={theme}
                                                onChange={e => setTheme(e.target.value as any)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="modern">Modern Classic</option>
                                                <option value="dark-neon">Dark Neon Glow</option>
                                                <option value="glassmorphism">Frosted Glassmorphism</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Headline */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Value Proposition / Headline *</label>
                                        <input
                                            required
                                            type="text"
                                            value={headline}
                                            onChange={e => setHeadline(e.target.value)}
                                            placeholder="e.g. The slimmest RFID-blocking wallet you will ever own."
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Product Description</label>
                                        <textarea
                                            value={description}
                                            onChange={e => setDescription(e.target.value)}
                                            rows={3}
                                            placeholder="Detailed marketing description..."
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                        />
                                    </div>

                                    {/* Features list */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Key Product Benefits / Features</label>
                                        <div className="space-y-2">
                                            {features.map((feature, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <input
                                                        type="text"
                                                        value={feature}
                                                        onChange={e => handleFeatureChange(idx, e.target.value)}
                                                        placeholder={`Benefit ${idx + 1}`}
                                                        className="flex-1 px-3 py-1.5 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFeatureField(idx)}
                                                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={addFeatureField}
                                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Add Benefit Item
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pricing & CTA */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Price *</label>
                                            <input
                                                required
                                                type="number"
                                                step="0.01"
                                                value={price}
                                                onChange={e => setPrice(e.target.value)}
                                                placeholder="0.00"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Currency</label>
                                            <select
                                                value={currency}
                                                onChange={e => setCurrency(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                            >
                                                <option value="USD">USD ($)</option>
                                                <option value="ZAR">ZAR (R)</option>
                                                <option value="EUR">EUR (€)</option>
                                                <option value="GBP">GBP (£)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">CTA Button Label</label>
                                            <input
                                                type="text"
                                                value={ctaText}
                                                onChange={e => setCtaText(e.target.value)}
                                                placeholder="Buy Now"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Image Url */}
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Product Image URL</label>
                                        <input
                                            type="text"
                                            value={imageUrl}
                                            onChange={e => setImageUrl(e.target.value)}
                                            placeholder="https://example.com/product.jpg"
                                            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        />
                                    </div>
                                </>
                            )}

                            {formSection === 'abtest' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl">
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">Activate A/B Split Testing</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">Distribute traffic 50/50 and measure which variant theme & copy converts best</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={isAbTest}
                                            onChange={e => setIsAbTest(e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                        />
                                    </div>

                                    {isAbTest && (
                                        <div className="space-y-4 border border-gray-250 p-4 rounded-2xl bg-white shadow-xs">
                                            <p className="text-xs font-bold text-gray-800 border-b border-gray-150 pb-2">Variant B Configuration</p>
                                            
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Variant B Theme</label>
                                                <select
                                                    value={variantTheme}
                                                    onChange={e => setVariantTheme(e.target.value as any)}
                                                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                >
                                                    <option value="modern">Modern Classic</option>
                                                    <option value="dark-neon">Dark Neon Glow</option>
                                                    <option value="glassmorphism">Frosted Glassmorphism</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Variant B Headline</label>
                                                <input
                                                    type="text"
                                                    value={variantHeadline}
                                                    onChange={e => setVariantHeadline(e.target.value)}
                                                    placeholder="Alt headline for split testing"
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Variant B Description</label>
                                                <textarea
                                                    value={variantDescription}
                                                    onChange={e => setVariantDescription(e.target.value)}
                                                    rows={3}
                                                    placeholder="Alt description for split testing..."
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Variant B Price (Optional)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={variantPrice}
                                                    onChange={e => setVariantPrice(e.target.value)}
                                                    placeholder="Leave empty to use base price"
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {formSection === 'payments' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">Use Live Production Payments</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">Redirect checkouts to your live Stripe payment gateway (deactivates simulations)</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            checked={useLivePayments}
                                            onChange={e => setUseLivePayments(e.target.checked)}
                                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                                        />
                                    </div>

                                    {useLivePayments && (
                                        <div className="space-y-4 border border-gray-250 p-4 rounded-2xl bg-white shadow-xs">
                                            <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-100 flex items-start gap-2.5">
                                                <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold">Important Security Notice</p>
                                                    <p className="text-[10px] leading-relaxed mt-0.5">Ensure you paste a valid live Stripe Secret Key. Keys are encrypted and used solely to initialize payments directly between you and your client.</p>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Stripe Secret Key (sk_live_*)</label>
                                                <input
                                                    type="password"
                                                    value={stripeSecretKey}
                                                    onChange={e => setStripeSecretKey(e.target.value)}
                                                    placeholder="sk_live_..."
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">PayPal Client ID (Optional)</label>
                                                <input
                                                    type="text"
                                                    value={paypalClientId}
                                                    onChange={e => setPaypalClientId(e.target.value)}
                                                    placeholder="PayPal Live Client ID"
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {formSection === 'pixels' && (
                                <div className="space-y-4">
                                    <div className="border border-gray-250 p-4 rounded-2xl bg-white shadow-xs space-y-4">
                                        <p className="text-xs font-bold text-gray-800 border-b border-gray-150 pb-2">Advertising Conversion Tracking</p>
                                        
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Meta Pixel ID</label>
                                            <input
                                                type="text"
                                                value={metaPixelId}
                                                onChange={e => setMetaPixelId(e.target.value)}
                                                placeholder="e.g. 1029384756"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <p className="text-[9px] text-gray-400 mt-1 font-medium">Fires Facebook Pixel PageView, InitiateCheckout, and Purchase events.</p>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Google Tag Manager (GTM) ID</label>
                                            <input
                                                type="text"
                                                value={gtmId}
                                                onChange={e => setGtmId(e.target.value)}
                                                placeholder="e.g. GTM-XXXXXX"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                            <p className="text-[9px] text-gray-400 mt-1 font-medium">Injects GTM script block dynamically into the storefront canvas.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Submit */}
                            <div className="flex gap-3 pt-4 border-t border-gray-150">
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} 
                                    {selectedPage ? 'Save Changes' : 'Generate Landing Page'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Storefront;
