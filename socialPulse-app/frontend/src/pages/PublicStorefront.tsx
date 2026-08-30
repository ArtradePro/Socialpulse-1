import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
    ShoppingBag, ShieldCheck, Truck, RotateCcw, Loader2, 
    X, CreditCard, Sparkles, CheckCircle2, User, Mail
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { storefrontService, SalesPage } from '../services/storefrontService';

declare global {
    interface Window {
        fbq?: any;
        _fbq?: any;
        dataLayer?: any[];
        gtag?: (...args: any[]) => void;
    }
}

const initMetaPixel = (pixelId: string) => {
    if (window.fbq) return;
    (function (f: any, b: any, e: any, v: any) {
        if (f.fbq) return;
        let n: any = f.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        let t = b.createElement(e) as HTMLScriptElement;
        t.async = !0;
        t.src = v;
        let s = b.getElementsByTagName(e)[0];
        s.parentNode?.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', pixelId);
};

const initGTM = (gtmId: string) => {
    if (window.dataLayer) return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    
    if (gtmId.startsWith('GTM-')) {
        const f = document.getElementsByTagName('script')[0];
        const j = document.createElement('script') as HTMLScriptElement;
        j.async = true;
        j.src = 'https://www.googletagmanager.com/gtm.js?id=' + gtmId;
        f.parentNode?.insertBefore(j, f);
    } else {
        const script = document.createElement('script') as HTMLScriptElement;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${gtmId}`;
        document.head.appendChild(script);
        
        window.gtag = function () {
            window.dataLayer?.push(arguments);
        };
        window.gtag('js', new Date());
        window.gtag('config', gtmId);
    }
};

export const PublicStorefront: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [page, setPage] = useState<SalesPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    
    // Checkout states
    const [showCheckout, setShowCheckout] = useState(false);
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');
    const [checkingOut, setCheckingOut] = useState(false);
    const [checkoutSuccess, setCheckoutSuccess] = useState(false);

    useEffect(() => {
        if (!slug) return;
        
        storefrontService.getPublicPage(slug)
            .then(async (res) => {
                setPage(res);

                // Inject and trigger PageView tracking if configured
                if (res.meta_pixel_id) {
                    initMetaPixel(res.meta_pixel_id);
                    window.fbq?.('track', 'PageView');
                }
                if (res.gtm_id) {
                    initGTM(res.gtm_id);
                    window.dataLayer?.push({ event: 'pageview' });
                }

                // Check for Stripe Checkout success/cancel callback parameters in URL
                const query = new URLSearchParams(window.location.search);
                const checkoutStatus = query.get('checkout_status');
                const sessionId = query.get('session_id');
                const qVariant = query.get('variant') || 'A';

                if (checkoutStatus === 'success' && sessionId) {
                    setCheckingOut(true);
                    setShowCheckout(true);
                    
                    try {
                        await storefrontService.processCheckout({
                            sales_page_id: res.id,
                            variant_used: qVariant,
                            stripe_session_id: sessionId
                        });
                        setCheckoutSuccess(true);
                        toast.success('Payment verified and order confirmed!');
                        
                        // Fire Purchase tracking events with server-approved price
                        const verifiedPrice = res.active_price !== undefined && res.active_price !== null ? res.active_price : res.price;
                        if (res.meta_pixel_id) {
                            window.fbq?.('track', 'Purchase', { value: verifiedPrice, currency: res.currency });
                        }
                        if (res.gtm_id) {
                            window.dataLayer?.push({ event: 'purchase', value: verifiedPrice, currency: res.currency });
                            window.gtag?.('event', 'purchase', { value: verifiedPrice, currency: res.currency });
                        }
                    } catch (err: any) {
                        toast.error(err.response?.data?.message || 'Failed to verify payment order. Please contact support.');
                    } finally {
                        setCheckingOut(false);
                    }
                    
                    // Clear search queries for a clean URL
                    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                    window.history.replaceState({ path: newUrl }, '', newUrl);
                } else if (checkoutStatus === 'cancel') {
                    toast.error('Payment checkout was cancelled.');
                    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                    window.history.replaceState({ path: newUrl }, '', newUrl);
                }
            })
            .catch(() => {
                setError(true);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [slug]);

    const handleCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!page) return;
        if (!customerName.trim() || !customerEmail.trim()) {
            toast.error('Name and email are required');
            return;
        }

        const activePrice = page.active_price !== undefined && page.active_price !== null ? page.active_price : page.price;

        setCheckingOut(true);
        try {
            const checkoutRes = await storefrontService.processCheckout({
                sales_page_id: page.id,
                customer_name: customerName,
                customer_email: customerEmail,
                amount: activePrice,
                currency: page.currency,
                variant_used: page.assigned_variant || 'A'
            }) as any;

            if (checkoutRes.stripe_checkout_url) {
                // Redirect to Stripe checkout page
                window.location.href = checkoutRes.stripe_checkout_url;
                return;
            }

            setCheckoutSuccess(true);
            toast.success('Payment completed successfully!');

            // Fire Purchase tracking events for mock orders
            if (page.meta_pixel_id) {
                window.fbq?.('track', 'Purchase', { value: activePrice, currency: page.currency });
            }
            if (page.gtm_id) {
                window.dataLayer?.push({ event: 'purchase', value: activePrice, currency: page.currency });
                window.gtag?.('event', 'purchase', { value: activePrice, currency: page.currency });
            }
        } catch (err) {
            toast.error('Payment failed. Please try again.');
        } finally {
            setCheckingOut(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (error || !page) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 text-center">
                <ShoppingBag className="w-16 h-16 text-gray-300 mb-4" />
                <h1 className="text-xl font-bold text-gray-800">Storefront Not Found</h1>
                <p className="text-gray-500 mt-2">The sales page you are looking for does not exist or has been removed.</p>
                <a href="/" className="mt-6 px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700">
                    Back to Dashboard
                </a>
            </div>
        );
    }

    // Dynamic layout themes styling mapping to Variant values if assigned
    const activeTheme = page.active_theme || page.theme || 'modern';
    const activeHeadline = page.active_headline !== undefined ? page.active_headline : page.headline;
    const activeDescription = page.active_description !== undefined ? page.active_description : page.description;
    const activePrice = page.active_price !== undefined && page.active_price !== null ? page.active_price : page.price;

    let themeBg = 'bg-[#F9FAFB] text-gray-900';
    let cardClass = 'bg-white border border-gray-200 shadow-xl';
    let btnClass = 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20';
    let accentText = 'text-indigo-600';
    let listDot = 'bg-indigo-100 text-indigo-600';

    if (activeTheme === 'dark-neon') {
        themeBg = 'bg-[#0B0F19] text-gray-100 min-h-screen relative overflow-hidden';
        cardClass = 'bg-[#151D30]/80 backdrop-blur-md border border-[#23304E] shadow-[0_0_30px_rgba(0,0,0,0.5)]';
        btnClass = 'bg-linear-to-r from-violet-600 to-indigo-600 text-white font-extrabold hover:brightness-110 shadow-[0_0_15px_rgba(139,92,246,0.4)] active:scale-[0.98] transition-all';
        accentText = 'text-violet-400';
        listDot = 'bg-violet-500/10 text-violet-400 border border-violet-500/20';
    } else if (activeTheme === 'glassmorphism') {
        themeBg = 'bg-linear-to-tr from-[#EEF2FF] via-[#F5F3FF] to-[#FDF2F8] min-h-screen relative overflow-hidden flex items-center justify-center p-4';
        cardClass = 'backdrop-blur-xl bg-white/40 border border-white/40 shadow-[0_8px_32px_0_rgba(31,38,135,0.08)]';
        btnClass = 'bg-linear-to-r from-purple-600 to-pink-600 text-white font-bold hover:opacity-95 shadow-lg shadow-purple-500/20 active:scale-[0.98] transition-all';
        accentText = 'text-purple-600';
        listDot = 'bg-purple-100 text-purple-600';
    }

    return (
        <div className={`${themeBg} flex justify-center py-8 px-4`}>
            <Toaster position="top-center" />
            
            {/* Visual background elements for Neon/Glass themes */}
            {activeTheme === 'dark-neon' && (
                <>
                    <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
                    <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
                </>
            )}
            {activeTheme === 'glassmorphism' && (
                <>
                    <div className="absolute top-[10%] left-[10%] w-56 h-56 rounded-full bg-purple-300/30 blur-2xl pointer-events-none animate-pulse" />
                    <div className="absolute bottom-[10%] right-[10%] w-72 h-72 rounded-full bg-pink-300/20 blur-2xl pointer-events-none animate-pulse" />
                </>
            )}

            <div className={`w-full max-w-md rounded-3xl p-6 ${cardClass} flex flex-col gap-6 z-10`}>
                
                {/* Header branding */}
                <div className="flex items-center gap-2 border-b border-gray-150/20 pb-4">
                    <ShoppingBag className={`w-5 h-5 ${accentText}`} />
                    <span className="text-xs font-black tracking-widest uppercase">SocialPulse Shop</span>
                </div>

                {/* Product Media */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-gray-150/10 bg-gray-50 flex items-center justify-center">
                    {page.image_url ? (
                        <img src={page.image_url} alt={page.title} className="w-full h-full object-cover" />
                    ) : (
                        <ShoppingBag className="w-12 h-12 text-gray-300" />
                    )}
                </div>

                {/* Product Details */}
                <div className="space-y-2">
                    <h1 className="text-xl font-extrabold tracking-tight">{page.title}</h1>
                    <p className={`text-2xl font-black ${accentText}`}>
                        {page.currency} {activePrice}
                    </p>
                    <p className="text-sm leading-relaxed opacity-80 mt-3">{activeHeadline}</p>
                    {activeDescription && (
                        <p className="text-xs leading-relaxed opacity-60 font-medium mt-2">{activeDescription}</p>
                    )}
                </div>

                {/* Features Checklist */}
                {page.features && page.features.length > 0 && (
                    <div className="space-y-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider opacity-50">What you get:</p>
                        <ul className="space-y-2">
                            {page.features.map((feature, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-xs font-semibold">
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${listDot}`}>
                                        ✓
                                    </div>
                                    <span className="opacity-95 mt-0.5">{feature}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2 py-2 border-y border-gray-150/10 text-[9px] font-bold uppercase tracking-wide opacity-65 text-center">
                    <div className="flex flex-col items-center gap-1.5">
                        <ShieldCheck className={`w-4 h-4 ${accentText}`} />
                        <span>Secure SSL</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <Truck className={`w-4 h-4 ${accentText}`} />
                        <span>Free Shipping</span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5">
                        <RotateCcw className={`w-4 h-4 ${accentText}`} />
                        <span>30-Day Returns</span>
                    </div>
                </div>

                {/* Purchase CTA */}
                <button
                    onClick={() => {
                        setCustomerName('');
                        setCustomerEmail('');
                        setCardNumber('');
                        setCardExpiry('');
                        setCardCvv('');
                        setCheckoutSuccess(false);
                        setShowCheckout(true);

                        // Fire InitiateCheckout tracking events
                        if (page.meta_pixel_id) {
                            window.fbq?.('track', 'InitiateCheckout');
                        }
                        if (page.gtm_id) {
                            window.dataLayer?.push({ event: 'initiate_checkout' });
                            window.gtag?.('event', 'begin_checkout');
                        }
                    }}
                    className={`w-full py-4.5 rounded-2xl text-sm font-black flex items-center justify-center gap-2 cursor-pointer ${btnClass}`}
                >
                    <ShoppingBag className="w-4 h-4" /> {page.cta_text}
                </button>
            </div>

            {/* Checkout Sheet Dialog */}
            {showCheckout && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden text-gray-900 shadow-2xl flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-150">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-indigo-600" />
                                <span className="font-extrabold text-sm uppercase tracking-wide">Secure Checkout</span>
                            </div>
                            <button onClick={() => setShowCheckout(false)} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {checkoutSuccess ? (
                            <div className="p-8 text-center flex flex-col items-center justify-center gap-4">
                                <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-bounce" />
                                <h2 className="text-lg font-black text-gray-900">Order Confirmed!</h2>
                                <p className="text-sm text-gray-500 font-medium px-4">
                                    Thank you, {customerName}! We have received your payment of <span className="font-bold text-gray-800">{page.currency} {activePrice}</span>.
                                </p>
                                <p className="text-xs text-gray-400">A confirmation receipt has been sent to {customerEmail}.</p>
                                <button
                                    onClick={() => setShowCheckout(false)}
                                    className="mt-6 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/10 active:scale-[0.98] transition-all"
                                >
                                    Done
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleCheckout} className="p-5 flex-1 overflow-y-auto space-y-4">
                                {/* Order Summary */}
                                <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between border border-gray-100">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Checkout Total</p>
                                        <p className="text-sm font-extrabold text-gray-800 truncate mt-0.5">{page.title}</p>
                                    </div>
                                    <span className="text-lg font-black text-indigo-600">{page.currency} {activePrice}</span>
                                </div>

                                {/* Billing Info */}
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Full Name</label>
                                        <div className="relative">
                                            <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                                            <input
                                                required
                                                type="text"
                                                value={customerName}
                                                onChange={e => setCustomerName(e.target.value)}
                                                placeholder="John Doe"
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                                            <input
                                                required
                                                type="email"
                                                value={customerEmail}
                                                onChange={e => setCustomerEmail(e.target.value)}
                                                placeholder="john@example.com"
                                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Credit Card details - Hide or show mock input based on Stripe status */}
                                {(!page.use_live_payments || !page.stripe_secret_key) && (
                                    <div className="space-y-3 pt-2 border-t border-gray-100">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Card Number</label>
                                            <input
                                                required
                                                type="text"
                                                value={cardNumber}
                                                onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').substring(0, 16))}
                                                placeholder="4111 2222 3333 4444"
                                                className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 tracking-widest font-mono"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Expiry Date</label>
                                                <input
                                                    required
                                                    type="text"
                                                    value={cardExpiry}
                                                    onChange={e => {
                                                        let val = e.target.value.replace(/\D/g, '');
                                                        if (val.length > 2) val = `${val.substring(0, 2)}/${val.substring(2, 4)}`;
                                                        setCardExpiry(val);
                                                    }}
                                                    placeholder="MM/YY"
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">CVV</label>
                                                <input
                                                    required
                                                    type="password"
                                                    value={cardCvv}
                                                    onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').substring(0, 3))}
                                                    placeholder="***"
                                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono tracking-widest"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Submit payment */}
                                <button
                                    type="submit"
                                    disabled={checkingOut}
                                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 disabled:opacity-50 mt-4 active:scale-[0.98] transition-all"
                                >
                                    {checkingOut ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Processing payment...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 text-amber-300" />
                                            <span>
                                                {page.use_live_payments && page.stripe_secret_key ? 'Proceed to Live Payment' : `Pay ${page.currency} ${activePrice}`}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PublicStorefront;
