import { useState, useEffect } from 'react';
import { Search, Package, Plus, X, Loader2 } from 'lucide-react';
import api from '../../services/api';

interface Product {
    id: string;
    title: string;
    price: number;
    currency: string;
    image_url: string;
    product_url: string;
}

interface ProductPickerProps {
    open: boolean;
    onClose: () => void;
    onSelect: (product: Product) => void;
}

export const ProductPicker = ({ open, onClose, onSelect }: ProductPickerProps) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (open) fetchProducts();
    }, [open]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/ecommerce/products');
            setProducts(data.products);
        } catch (err) {
            console.error('Failed to fetch products');
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-600" />
                        Pick a Product
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Search products..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-2" />
                            <p className="text-sm text-gray-500 font-medium">Loading products...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {products.filter(p => p.title.toLowerCase().includes(search.toLowerCase())).map(product => (
                                <div 
                                    key={product.id}
                                    onClick={() => onSelect(product)}
                                    className="group cursor-pointer bg-white rounded-2xl border border-gray-200 p-3 hover:border-purple-300 hover:shadow-md transition-all relative overflow-hidden"
                                >
                                    <img 
                                        src={product.image_url || 'https://via.placeholder.com/150'} 
                                        alt={product.title}
                                        className="w-full aspect-square object-cover rounded-xl bg-gray-100 mb-3"
                                    />
                                    <p className="text-sm font-semibold text-gray-900 truncate">{product.title}</p>
                                    <p className="text-xs text-purple-600 font-bold">{product.currency} {product.price}</p>
                                    
                                    <div className="absolute inset-0 bg-purple-600/0 group-hover:bg-purple-600/5 transition-colors flex items-center justify-center">
                                        <Plus className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                </div>
                            ))}

                            {products.length === 0 && (
                                <div className="col-span-full py-12 text-center">
                                    <Package className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                                    <p className="text-gray-500">No products found</p>
                                    <p className="text-xs text-gray-400 mt-1">Connect a store to sync your catalog</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
