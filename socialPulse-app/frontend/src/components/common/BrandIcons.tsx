import React from 'react';
import { 
  Twitter, Instagram, Facebook, Linkedin, 
  Youtube, Globe, Pin, Smartphone 
} from 'lucide-react';

interface IconProps {
  size?: number;
  className?: string;
}

export const TwitterXIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export const InstagramIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <Instagram size={size} className={className} />
);

export const FacebookIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <Facebook size={size} className={className} />
);

export const LinkedinIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <Linkedin size={size} className={className} />
);

export const TiktokIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

export const YoutubeIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <Youtube size={size} className={className} />
);

export const PinterestIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <Pin size={size} className={className} />
);

export const PlatformIcon: React.FC<{ platform: string; size?: number; className?: string }> = ({ platform, size, className = "" }) => {
  const p = platform.toLowerCase();
  
  // Base brand colors for icons when not overridden by className
  const getBrandClass = () => {
    if (className.includes('text-')) return className;
    switch (p) {
      case 'twitter':
      case 'x':         return `text-black ${className}`;
      case 'instagram': return `text-[#E4405F] ${className}`;
      case 'facebook':  return `text-[#1877F2] ${className}`;
      case 'linkedin':  return `text-[#0077B5] ${className}`;
      case 'tiktok':    return `text-black ${className}`;
      case 'youtube':   return `text-[#FF0000] ${className}`;
      case 'pinterest': return `text-[#BD081C] ${className}`;
      default:          return className;
    }
  };

  const activeClass = getBrandClass();

  switch (p) {
    case 'twitter':
    case 'x':
      return <TwitterXIcon size={size} className={activeClass} />;
    case 'instagram':
      return <InstagramIcon size={size} className={activeClass} />;
    case 'facebook':
      return <FacebookIcon size={size} className={activeClass} />;
    case 'linkedin':
      return <LinkedinIcon size={size} className={activeClass} />;
    case 'tiktok':
      return <TiktokIcon size={size} className={activeClass} />;
    case 'youtube':
      return <YoutubeIcon size={size} className={activeClass} />;
    case 'pinterest':
      return <PinterestIcon size={size} className={activeClass} />;
    default:
      return <Globe size={size} className={activeClass} />;
  }
};

