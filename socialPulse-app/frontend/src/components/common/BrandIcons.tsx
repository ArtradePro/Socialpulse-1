import React from 'react';
import { Globe } from 'lucide-react';

interface IconProps {
  size?: number;
  className?: string;
}

const imgIcon = (src: string, alt: string, size: number, className?: string) => (
  <img src={src} alt={alt} width={size} height={size} className={`object-contain ${className ?? ''}`} />
);

export const TwitterXIcon: React.FC<IconProps> = ({ size = 24, className }) =>
  imgIcon('/icons/platforms/twitter.jpeg', 'X (Twitter)', size, className);

export const InstagramIcon: React.FC<IconProps> = ({ size = 24, className }) =>
  imgIcon('/icons/platforms/instagram.jpeg', 'Instagram', size, className);

export const FacebookIcon: React.FC<IconProps> = ({ size = 24, className }) =>
  imgIcon('/icons/platforms/facebook.jpeg', 'Facebook', size, className);

export const LinkedinIcon: React.FC<IconProps> = ({ size = 24, className }) =>
  imgIcon('/icons/platforms/linkedin.jpeg', 'LinkedIn', size, className);

export const TiktokIcon: React.FC<IconProps> = ({ size = 24, className }) =>
  imgIcon('/icons/platforms/tiktok.jpeg', 'TikTok', size, className);

export const YoutubeIcon: React.FC<IconProps> = ({ size = 24, className }) =>
  imgIcon('/icons/platforms/youtube.jpeg', 'YouTube', size, className);

/** Pinterest — no image file provided, keep SVG badge */
export const PinterestIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="8" fill="#BD081C" />
    <path
      d="M16 6C10.48 6 6 10.48 6 16c0 4.24 2.65 7.88 6.4 9.33-.09-.8-.17-2.03.04-2.9.18-.77 1.24-5.24 1.24-5.24s-.32-.63-.32-1.57c0-1.47.85-2.57 1.91-2.57.9 0 1.34.67 1.34 1.48 0 .9-.58 2.26-.87 3.51-.25 1.05.52 1.9 1.55 1.9 1.86 0 3.11-2.38 3.11-5.2 0-2.15-1.46-3.66-3.55-3.66-2.42 0-3.84 1.82-3.84 3.7 0 .73.28 1.52.63 1.95.07.08.08.16.06.24-.06.27-.2.85-.23.97-.04.15-.12.18-.29.1-1.1-.51-1.78-2.12-1.78-3.41 0-2.77 2.02-5.32 5.82-5.32 3.06 0 5.43 2.18 5.43 5.09 0 3.04-1.91 5.48-4.56 5.48-.89 0-1.73-.46-2.02-1.01l-.55 2.05c-.2.77-.74 1.73-1.1 2.32.83.26 1.7.4 2.61.4 5.52 0 10-4.48 10-10S21.52 6 16 6z"
      fill="#ffffff"
    />
  </svg>
);

export const PlatformIcon: React.FC<{ platform: string; size?: number; className?: string }> = ({ platform, size = 24, className = "" }) => {
  const p = platform.toLowerCase();
  const props = { size, className };

  switch (p) {
    case 'twitter':
    case 'x':
      return <TwitterXIcon {...props} />;
    case 'instagram':
      return <InstagramIcon {...props} />;
    case 'facebook':
      return <FacebookIcon {...props} />;
    case 'linkedin':
      return <LinkedinIcon {...props} />;
    case 'tiktok':
      return <TiktokIcon {...props} />;
    case 'youtube':
      return <YoutubeIcon {...props} />;
    case 'pinterest':
      return <PinterestIcon {...props} />;
    default:
      return <Globe size={size} className={className} />;
  }
};

