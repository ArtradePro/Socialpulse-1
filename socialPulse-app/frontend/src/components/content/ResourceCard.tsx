import React from 'react';
import { ExternalLink, Star } from 'lucide-react';

interface ResourceCardProps {
    name: string;
    description: string;
    bestFor: string[];
    rating: number;
    url: string;
    icon: React.ReactNode;
    color: string;
    isPremium?: boolean;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ 
    name, description, bestFor, rating, url, icon, color, isPremium 
}) => {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:border-transparent transition-all duration-300 group relative overflow-hidden flex flex-col">
            {isPremium && (
                <div className="absolute -right-12 top-6 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[10px] font-bold py-1 px-12 rotate-45 shadow-sm">
                    POPULAR
                </div>
            )}
            
            <div className="flex items-start gap-4 mb-4">
                <div className={`p-3 rounded-2xl ${color === 'canva' ? 'bg-canva-gradient' : color} ${color !== 'canva' && 'bg-opacity-10'} group-hover:scale-110 transition-transform duration-300`}>
                    <div className={color === 'canva' ? 'text-white' : color.replace('bg-', 'text-')}>
                        {icon}
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-gray-900 truncate">{name}</h3>
                        <div className="flex gap-0.5">
                            {[...Array(5)].map((_, i) => (
                                <Star 
                                    key={i} 
                                    className={`w-3 h-3 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} 
                                />
                            ))}
                        </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{description}</p>
                </div>
            </div>

            <div className="space-y-3 flex-1">
                <div className="flex flex-wrap gap-1.5">
                    {bestFor.map(tag => (
                        <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-100">
                            {tag}
                        </span>
                    ))}
                </div>
            </div>

            <div className="mt-6">
                <a 
                    href={url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 w-full py-3 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold transition-all duration-300 ${
                        name === 'Canva' 
                            ? 'group-hover:bg-canva-gradient group-hover:text-white group-hover:shadow-lg group-hover:shadow-cyan-500/20' 
                            : 'group-hover:bg-indigo-600 group-hover:text-white'
                    }`}
                >
                    Explore Templates
                    <ExternalLink className="w-4 h-4" />
                </a>
            </div>
        </div>
    );
};

export default ResourceCard;
