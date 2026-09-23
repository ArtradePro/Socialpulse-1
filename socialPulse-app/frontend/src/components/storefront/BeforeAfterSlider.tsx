import React, { useState, useRef, useCallback } from 'react';
import { Sparkles, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export interface BeforeAfterSliderProps {
    category?: 'fnm' | 'hair' | 'skin';
    theme?: 'modern' | 'dark-neon' | 'glassmorphism';
    compact?: boolean;
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
    category = 'fnm',
    theme = 'modern',
    compact = false
}) => {
    const [sliderPos, setSliderPos] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMove = useCallback((clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPos(percentage);
    }, []);

    const handleTouchMove = (e: React.TouchEvent) => {
        handleMove(e.touches[0].clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        handleMove(e.clientX);
    };

    // Category data presets
    const presets = {
        fnm: {
            title: 'Fungus No More™ Dual Action Defense',
            badge: '98.4% Microbial Clearance (10-Day Higienlabs Study)',
            beforeLabel: 'DAY 1: Fungal Infection',
            beforeDesc: 'Persistent nail bed discoloration, athlete’s foot redness, itching & peeling',
            afterLabel: 'DAY 10: Clinical Clearance',
            afterDesc: 'Healthy fortified nail plate, calm skin barrier & zero fungal residue',
            beforeBg: 'from-amber-950 via-rose-950 to-neutral-900',
            afterBg: 'from-emerald-950 via-teal-950 to-cyan-950',
            beforeAccent: 'text-rose-400',
            afterAccent: 'text-emerald-400',
            productTag: '500ml Shower Gel + 50ml Coconut Spray'
        },
        hair: {
            title: 'Higienlabs™ Active Botanical Hair Growth',
            badge: '89.2% Increased Follicle Density in 45 Days',
            beforeLabel: 'DAY 1: Follicular Thinning',
            beforeDesc: 'Dormant hair roots, widening part line & sparse scalp coverage',
            afterLabel: 'DAY 45: Active Bio-Revival',
            afterDesc: 'Revitalized hair matrix, dense root reinforcement & thick new strands',
            beforeBg: 'from-orange-950 via-amber-950 to-neutral-900',
            afterBg: 'from-indigo-950 via-violet-950 to-neutral-900',
            beforeAccent: 'text-amber-400',
            afterAccent: 'text-violet-400',
            productTag: 'Micro-Targeted Scalp Peptide Serum'
        },
        skin: {
            title: 'Higienlabs™ Clinical Barrier Skin Care',
            badge: 'Triple Lipid Layer Restoration & Soothing',
            beforeLabel: 'DAY 1: Compromised Barrier',
            beforeDesc: 'Severe dermal inflammation, eczema flaking & stinging discomfort',
            afterLabel: 'DAY 14: Fortified Dermis',
            afterDesc: 'Supple moisture matrix, balanced microbiome & calm smooth skin',
            beforeBg: 'from-red-950 via-rose-950 to-stone-900',
            afterBg: 'from-sky-950 via-teal-950 to-blue-950',
            beforeAccent: 'text-rose-300',
            afterAccent: 'text-cyan-300',
            productTag: 'Bio-Ceramide & Botanical Relief Complex'
        }
    };

    const current = presets[category] || presets.fnm;
    const isDark = theme === 'dark-neon';

    return (
        <div className={`w-full rounded-2xl overflow-hidden border shadow-sm ${isDark ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white border-gray-200'}`}>
            {/* Header info */}
            <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-gray-150'}`}>
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <div>
                        <h4 className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                            Clinical Proof: Before & After
                        </h4>
                        <p className="text-[10px] text-gray-500 font-medium">{current.badge}</p>
                    </div>
                </div>
                <span className="text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Interactive Drag
                </span>
            </div>

            {/* Interactive Visual Comparison Stage */}
            <div
                ref={containerRef}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onMouseMove={handleMouseMove}
                onTouchMove={handleTouchMove}
                className="relative w-full aspect-16/10 select-none overflow-hidden cursor-ew-resize"
            >
                {/* AFTER Panel (Full base) */}
                <div className={`absolute inset-0 bg-linear-to-br ${current.afterBg} flex flex-col justify-between p-5 text-white`}>
                    <div className="flex justify-end">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/80 text-white px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-xs">
                            <CheckCircle2 className="w-3 h-3" /> {current.afterLabel}
                        </span>
                    </div>

                    <div className="max-w-[70%] self-end text-right space-y-1 drop-shadow-md">
                        <div className="text-xs font-extrabold text-emerald-300">Clinically Restored</div>
                        <p className="text-[11px] leading-tight text-emerald-100/90 font-medium">
                            {current.afterDesc}
                        </p>
                    </div>
                </div>

                {/* BEFORE Panel (Clipped overlay) */}
                <div
                    style={{ clipPath: `polygon(0 0, ${sliderPos}% 0, ${sliderPos}% 100%, 0 100%)` }}
                    className={`absolute inset-0 bg-linear-to-br ${current.beforeBg} flex flex-col justify-between p-5 text-white`}
                >
                    <div className="flex justify-start">
                        <span className="text-[10px] font-black uppercase tracking-wider bg-rose-600/80 text-white px-2.5 py-1 rounded-full shadow-sm flex items-center gap-1 backdrop-blur-xs">
                            <AlertCircle className="w-3 h-3" /> {current.beforeLabel}
                        </span>
                    </div>

                    <div className="max-w-[70%] text-left space-y-1 drop-shadow-md">
                        <div className="text-xs font-extrabold text-rose-300">Untreated Condition</div>
                        <p className="text-[11px] leading-tight text-rose-100/90 font-medium">
                            {current.beforeDesc}
                        </p>
                    </div>
                </div>

                {/* Vertical Divider Bar */}
                <div
                    style={{ left: `${sliderPos}%` }}
                    className="absolute top-0 bottom-0 w-0.75 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-20 pointer-events-none -translate-x-1/2"
                >
                    {/* Floating circular handle */}
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 w-8 h-8 rounded-full bg-white text-gray-800 shadow-xl flex items-center justify-center text-xs font-black border-2 border-emerald-500">
                        ⇄
                    </div>
                </div>
            </div>

            {/* Quick preset position buttons */}
            <div className={`p-3 bg-gray-50/50 flex items-center justify-between text-[10px] border-t ${isDark ? 'bg-slate-900/60 border-slate-800 text-gray-400' : 'border-gray-100 text-gray-500'}`}>
                <button
                    type="button"
                    onClick={() => setSliderPos(0)}
                    className="font-bold hover:text-emerald-600 transition-colors cursor-pointer"
                >
                    Show Day 10 (Full Result)
                </button>
                <button
                    type="button"
                    onClick={() => setSliderPos(50)}
                    className="font-bold text-gray-700 dark:text-gray-300 hover:text-emerald-600 transition-colors cursor-pointer"
                >
                    Split View (50/50)
                </button>
                <button
                    type="button"
                    onClick={() => setSliderPos(100)}
                    className="font-bold hover:text-rose-600 transition-colors cursor-pointer"
                >
                    Show Day 1 (Before)
                </button>
            </div>
        </div>
    );
};
