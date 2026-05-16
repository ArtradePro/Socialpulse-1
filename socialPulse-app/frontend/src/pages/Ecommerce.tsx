import { useState, useEffect } from 'react';
import { 
    ShoppingBag, Plus, RefreshCw, ExternalLink, Trash2, 
    AlertCircle, CheckCircle2, Store, Package, Search,
    Filter, MoreVertical, Loader2
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface EcommerceStore {
    id: string;
    platform: string;
    name: string;
    status: 'active' | 'inactive' | 'error';
    last_sync_at: string | null;
}

interface Product {
    id: string;
    title: string;
    description: string;
    price: number;
    currency: string;
    image_url: string;
    product_url: string;
    category: string;
    status: string;
}

export const Ecommerce = () => {
    const [stores, setStores] = useState<EcommerceStore[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    
    // Modal state
    const [showConnect, setShowConnect] = useState(false);
    const [newStore, setNewStore] = useState({
        platform: 'woocommerce',
        name: '',
        apiUrl: '',
        apiKey: '',
        apiSecret: '',
        sellerId: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [storesRes, productsRes] = await Promise.all([
                api.get('/ecommerce/stores'),
                api.get('/ecommerce/products')
            ]);
            setStores(storesRes.data);
            setProducts(productsRes.data.products);
        } catch (err) {
            toast.error('Failed to load e-commerce data');
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/ecommerce/stores', newStore);
            toast.success('Store connected successfully');
            setShowConnect(false);
            fetchData();
        } catch (err) {
            toast.error('Failed to connect store');
        }
    };

    const handleSync = async (storeId: string) => {
        setSyncing(storeId);
        try {
            await api.post(`/ecommerce/stores/${storeId}/sync`);
            toast.success('Sync completed');
            fetchData();
        } catch (err) {
            toast.error('Sync failed');
        } finally {
            setSyncing(null);
        }
    };

    const handleDisconnect = async (storeId: string) => {
        if (!window.confirm('Are you sure you want to disconnect this store?')) return;
        try {
            await api.delete(`/ecommerce/stores/${storeId}`);
            toast.success('Store disconnected');
            fetchData();
        } catch (err) {
            toast.error('Failed to disconnect store');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">E-commerce</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage your online stores and product catalog</p>
                </div>
                <button 
                    onClick={() => setShowConnect(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-4 h-4" /> Connect Store
                </button>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search products by title or ID..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    />
                </div>
            </div>

            {/* Stores Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map(store => (
                    <div key={store.id} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <Store className="w-5 h-5 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900">{store.name}</h3>
                                    <p className="text-xs text-gray-500 capitalize">{store.platform}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => handleSync(store.id)}
                                    disabled={!!syncing}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-purple-600"
                                    title="Sync now"
                                >
                                    <RefreshCw className={`w-4 h-4 ${syncing === store.id ? 'animate-spin text-purple-600' : ''}`} />
                                </button>
                                <button 
                                    onClick={() => handleDisconnect(store.id)}
                                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
                                    title="Disconnect"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="mt-4 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                                {store.status === 'active' ? (
                                    <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                                        <CheckCircle2 className="w-3 h-3" /> Active
                                    </span>
                                ) : (
                                    <span className="flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                                        <AlertCircle className="w-3 h-3" /> Error
                                    </span>
                                )}
                            </div>
                            <span className="text-gray-400">
                                Last sync: {store.last_sync_at ? new Date(store.last_sync_at).toLocaleDateString() : 'Never'}
                            </span>
                        </div>
                    </div>
                ))}

                {stores.length === 0 && (
                    <div className="col-span-full py-12 bg-white rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
                        <ShoppingBag className="w-12 h-12 text-gray-300 mb-3" />
                        <p className="text-gray-500 font-medium">No stores connected yet</p>
                        <p className="text-sm text-gray-400 mt-1">Connect your WooCommerce or Shopify store to get started</p>
                    </div>
                )}
            </div>

            {/* Products Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-600" />
                        Product Catalog
                    </h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-full sm:w-64"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Product</th>
                                <th className="px-6 py-4">Price</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.filter(p => p.title.toLowerCase().includes(search.toLowerCase())).map(product => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <img 
                                                src={product.image_url || 'https://via.placeholder.com/40'} 
                                                alt={product.title}
                                                className="w-10 h-10 rounded-lg object-cover bg-gray-100"
                                            />
                                            <div className="max-w-xs">
                                                <p className="text-sm font-medium text-gray-900 truncate">{product.title}</p>
                                                <p className="text-xs text-gray-500 truncate">{product.product_url}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm font-semibold text-gray-900">
                                            {product.currency} {product.price.toFixed(2)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                                            {product.category || 'Uncategorized'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                            product.status === 'active' ? 'text-green-700 bg-green-50' : 'text-gray-600 bg-gray-50'
                                        }`}>
                                            {product.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <a 
                                                href={product.product_url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </a>
                                            <button className="p-2 text-gray-400 hover:text-purple-600 transition-colors">
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Connect Modal */}
            {showConnect && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900">Connect Your Store</h2>
                            <button onClick={() => setShowConnect(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <Plus className="w-6 h-6 rotate-45 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleConnect} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                                <select 
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={newStore.platform}
                                    onChange={(e) => setNewStore({...newStore, platform: e.target.value})}
                                >
                                    <option value="woocommerce">WooCommerce</option>
                                    <option value="shopify">Shopify</option>
                                    <option value="amazon">Amazon (Seller Central)</option>
                                    <option value="takealot">Takealot (Seller Portal)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
                                <input 
                                    type="text" 
                                    required
                                    placeholder={newStore.platform === 'takealot' ? 'My Takealot Store' : 'e.g. My Awesome Shop'}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={newStore.name}
                                    onChange={(e) => setNewStore({...newStore, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    {newStore.platform === 'amazon' ? 'Marketplace ID' : 'Store URL'}
                                </label>
                                <input 
                                    type="text"
                                    required
                                    placeholder={
                                        newStore.platform === 'amazon' ? 'e.g. A1F83G8C2ARO7P (South Africa)' : 
                                        newStore.platform === 'shopify' ? 'https://mystore.myshopify.com' : 
                                        'https://mysite.com'
                                    }
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={newStore.apiUrl}
                                    onChange={(e) => setNewStore({...newStore, apiUrl: e.target.value})}
                                />
                            </div>
                            
                            {newStore.platform === 'amazon' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Seller ID</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g. A2NXXXXXXXXXX"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        value={newStore.sellerId}
                                        onChange={(e) => setNewStore({...newStore, sellerId: e.target.value})}
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {newStore.platform === 'shopify' ? 'API Key (Opt)' : 
                                         newStore.platform === 'amazon' ? 'LWA Client ID' : 
                                         newStore.platform === 'takealot' ? 'Seller ID' : 
                                         'API Key'}
                                    </label>
                                    <input 
                                        type="password" 
                                        required={newStore.platform !== 'shopify'}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        value={newStore.apiKey}
                                        onChange={(e) => setNewStore({...newStore, apiKey: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {newStore.platform === 'shopify' ? 'Access Token' : 
                                         newStore.platform === 'amazon' ? 'LWA Client Secret' : 
                                         newStore.platform === 'takealot' ? 'API Key' : 
                                         'API Secret'}
                                    </label>
                                    <input 
                                        type="password" 
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                        value={newStore.apiSecret}
                                        onChange={(e) => setNewStore({...newStore, apiSecret: e.target.value})}
                                    />
                                </div>
                            </div>
                            {newStore.platform === 'amazon' && (
                                <p className="text-[10px] text-gray-400 mt-1">
                                    Amazon integration requires Selling Partner API credentials. Ensure your LWA credentials and Marketplace ID are correct.
                                </p>
                            )}
                            <button 
                                type="submit"
                                className="w-full py-4 bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-purple-200 hover:opacity-90 transition-opacity mt-4"
                            >
                                Connect Now
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
