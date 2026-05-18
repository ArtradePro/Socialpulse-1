import React from 'react';
import { Heart, MessageCircle, Share2, Repeat2, MoreHorizontal, Bookmark, Send } from 'lucide-react';
import { PlatformIcon } from '../common/BrandIcons';

interface PostPreviewProps {
    platform: string;
    content: string;
    hashtags: string[];
    mediaUrls: string[];
    brandName: string;
    brandLogoUrl: string;
}

export const PostPreview: React.FC<PostPreviewProps> = ({
    platform,
    content,
    hashtags,
    mediaUrls,
    brandName,
    brandLogoUrl
}) => {
    const handle = brandName.toLowerCase().replace(/\s/g, '');
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(brandName || 'S')}&background=7C3AED&color=fff`;
    const avatar = brandLogoUrl || defaultAvatar;

    const fullContent = `${content}${hashtags.length > 0 ? '\n\n' + hashtags.map(h => `#${h}`).join(' ') : ''}`;

    if (platform === 'twitter') {
        return (
            <div className="bg-white rounded-xl border border-gray-200 p-4 font-sans max-w-md mx-auto shadow-sm">
                <div className="flex gap-3">
                    <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover aspect-square shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 truncate">
                                <span className="font-bold text-[15px] text-gray-900 hover:underline cursor-pointer truncate">{brandName}</span>
                                <span className="text-[15px] text-gray-500 truncate">@{handle}</span>
                                <span className="text-[15px] text-gray-500">·</span>
                                <span className="text-[15px] text-gray-500 hover:underline cursor-pointer">Now</span>
                            </div>
                            <MoreHorizontal className="w-5 h-5 text-gray-500 shrink-0" />
                        </div>
                        <p className="text-[15px] text-gray-900 mt-0.5 whitespace-pre-wrap">{fullContent}</p>
                        {mediaUrls.length > 0 && (
                            <div className={`mt-3 grid gap-0.5 rounded-2xl overflow-hidden border border-gray-200 ${mediaUrls.length === 1 ? 'grid-cols-1' : mediaUrls.length === 2 ? 'grid-cols-2' : mediaUrls.length === 3 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                {mediaUrls.slice(0, 4).map((url, i) => (
                                    <img key={i} src={url} alt="" className={`object-cover w-full h-full ${mediaUrls.length === 1 ? 'aspect-video' : mediaUrls.length === 3 && i === 0 ? 'row-span-2' : 'aspect-square'}`} />
                                ))}
                            </div>
                        )}
                        <div className="flex justify-between items-center mt-3 text-gray-500 max-w-md pr-8">
                            <MessageCircle className="w-[18px] h-[18px] hover:text-blue-500 transition-colors cursor-pointer" />
                            <Repeat2 className="w-[18px] h-[18px] hover:text-green-500 transition-colors cursor-pointer" />
                            <Heart className="w-[18px] h-[18px] hover:text-pink-500 transition-colors cursor-pointer" />
                            <Share2 className="w-[18px] h-[18px] hover:text-blue-500 transition-colors cursor-pointer" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (platform === 'instagram') {
        return (
            <div className="bg-white border border-gray-200 rounded-sm font-sans max-w-sm mx-auto shadow-sm pb-3">
                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                        <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover aspect-square border border-gray-200 p-0.5" />
                        <span className="font-semibold text-sm text-gray-900">{handle}</span>
                    </div>
                    <MoreHorizontal className="w-5 h-5 text-gray-900" />
                </div>
                {mediaUrls.length > 0 ? (
                    <div className="relative aspect-square bg-black flex items-center justify-center overflow-hidden">
                        <img src={mediaUrls[0]} alt="" className="w-full h-full object-cover" />
                        {mediaUrls.length > 1 && (
                            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                1/{mediaUrls.length}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="aspect-square bg-gradient-to-tr from-purple-500 to-orange-400 flex items-center justify-center p-6 text-center text-white font-bold text-xl">
                        {content.substring(0, 100)}{content.length > 100 ? '...' : ''}
                    </div>
                )}
                <div className="p-3">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex gap-4">
                            <Heart className="w-6 h-6 hover:text-gray-500 cursor-pointer" />
                            <MessageCircle className="w-6 h-6 hover:text-gray-500 cursor-pointer" />
                            <Send className="w-6 h-6 hover:text-gray-500 cursor-pointer" />
                        </div>
                        <Bookmark className="w-6 h-6 hover:text-gray-500 cursor-pointer" />
                    </div>
                    <p className="text-sm font-semibold mb-1">0 likes</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                        <span className="font-semibold mr-2">{handle}</span>
                        {fullContent}
                    </p>
                </div>
            </div>
        );
    }

    if (platform === 'linkedin') {
        return (
            <div className="bg-white rounded-lg border border-gray-200 font-sans max-w-md mx-auto shadow-sm">
                <div className="p-4 flex gap-3 items-center">
                    <img src={avatar} alt="" className="w-12 h-12 rounded-full object-cover aspect-square" />
                    <div className="flex-1">
                        <h4 className="font-bold text-[15px] text-gray-900 leading-tight hover:text-blue-600 cursor-pointer">{brandName}</h4>
                        <p className="text-xs text-gray-500">Company</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">Just now <span className="text-[10px]">•</span> 🌐</p>
                    </div>
                    <MoreHorizontal className="w-5 h-5 text-gray-500" />
                </div>
                <div className="px-4 pb-2">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{fullContent}</p>
                </div>
                {mediaUrls.length > 0 && (
                    <div className="w-full">
                        <img src={mediaUrls[0]} alt="" className="w-full object-cover max-h-96" />
                        {mediaUrls.length > 1 && <div className="text-center py-2 text-sm text-gray-500 font-medium bg-gray-50 border-t border-gray-100">+{mediaUrls.length - 1} more images</div>}
                    </div>
                )}
                <div className="px-4 py-2 border-t border-gray-200 flex justify-between items-center mt-2">
                    <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 px-2 py-3 rounded transition-colors flex-1 justify-center">
                        <Heart className="w-5 h-5" /> Like
                    </button>
                    <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 px-2 py-3 rounded transition-colors flex-1 justify-center">
                        <MessageCircle className="w-5 h-5" /> Comment
                    </button>
                    <button className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 px-2 py-3 rounded transition-colors flex-1 justify-center">
                        <Share2 className="w-5 h-5" /> Share
                    </button>
                </div>
            </div>
        );
    }

    // Default Preview (Facebook, TikTok, Pinterest, etc)
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 font-sans max-w-md mx-auto shadow-sm">
             <div className="flex items-center gap-2 mb-3 border-b border-gray-100 pb-3">
                <PlatformIcon platform={platform} size={20} />
                <span className="font-semibold text-sm capitalize text-gray-700">{platform} Preview</span>
            </div>
            <div className='flex items-center gap-2 mb-3'>
                <img 
                    src={avatar} 
                    alt="" 
                    className='w-10 h-10 rounded-full border border-gray-200 object-cover aspect-square bg-white shrink-0' 
                />
                <div className="min-w-0">
                    <p className='text-[15px] font-bold text-gray-900 truncate hover:underline cursor-pointer'>{brandName || 'SocialPulse Identity'}</p>
                    <p className='text-xs text-gray-500'>Just now • 🌍</p>
                </div>
            </div>
            <p className="text-[15px] text-gray-900 whitespace-pre-wrap">{fullContent}</p>
            {mediaUrls.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-1">
                    {mediaUrls.map((url, idx) => (
                        <img key={idx} src={url} alt="" className="rounded-lg w-full object-cover max-h-80 shadow-sm border border-gray-100" />
                    ))}
                </div>
            )}
        </div>
    );
};
