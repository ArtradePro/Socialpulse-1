import React from 'react';
import { Globe } from 'lucide-react';

interface IconProps {
  size?: number;
  className?: string;
}

/** X / Twitter — black rounded-square badge */
export const TwitterXIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="7" fill="#000000" />
    <path
      d="M18.42 14.6L24.36 8h-1.4l-5.16 5.88L13.44 8H8l6.24 8.96L8 24h1.4l5.46-6.22L19.44 24H25L18.42 14.6zm-1.93 2.2-.63-.9-5.02-7.18h2.16l4.06 5.8.63.9 5.27 7.54h-2.16l-4.31-6.16z"
      fill="#ffffff"
    />
  </svg>
);

/** Instagram — official gradient badge */
export const InstagramIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <defs>
      <radialGradient id="ig-grad-a" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#ffd600" />
        <stop offset="50%" stopColor="#ff0069" />
        <stop offset="100%" stopColor="#d300c5" />
      </radialGradient>
      <radialGradient id="ig-grad-b" cx="0%" cy="100%" r="80%">
        <stop offset="0%" stopColor="#ff6a00" />
        <stop offset="100%" stopColor="#ff6a0000" />
      </radialGradient>
    </defs>
    <rect width="32" height="32" rx="8" fill="url(#ig-grad-a)" />
    <rect width="32" height="32" rx="8" fill="url(#ig-grad-b)" />
    <rect x="8" y="8" width="16" height="16" rx="4.5" stroke="#fff" strokeWidth="1.8" fill="none" />
    <circle cx="16" cy="16" r="4.2" stroke="#fff" strokeWidth="1.8" fill="none" />
    <circle cx="21.2" cy="10.8" r="1.1" fill="#fff" />
  </svg>
);

/** Facebook — blue badge */
export const FacebookIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="8" fill="#1877F2" />
    <path
      d="M21 8h-2.5C17.1 8 16 9.12 16 10.5V13h-3v3h3v8h3v-8h2.5l.5-3H19v-2c0-.28.22-.5.5-.5H21V8z"
      fill="#ffffff"
    />
  </svg>
);

/** LinkedIn — blue badge */
export const LinkedinIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="8" fill="#0077B5" />
    <path
      d="M10 13h3v10h-3V13zm1.5-4.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM15 13h2.9v1.4h.04C18.36 13.53 19.48 13 20.75 13 24.1 13 24.5 15.2 24.5 17.5V23h-3v-4.88c0-1.16-.02-2.66-1.62-2.66-1.63 0-1.88 1.27-1.88 2.58V23H15V13z"
      fill="#ffffff"
    />
  </svg>
);

/** TikTok — dark badge with official dual-color note */
export const TiktokIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="7" fill="#010101" />
    {/* cyan shadow */}
    <path
      d="M20.5 7.5v10.2a5.7 5.7 0 1 1-4-5.45v3.18a2.55 2.55 0 1 0 1.8 2.43V7.5h2.2z"
      fill="#69C9D0"
      transform="translate(-0.6, 0.4)"
    />
    {/* red shadow */}
    <path
      d="M20.5 7.5v10.2a5.7 5.7 0 1 1-4-5.45v3.18a2.55 2.55 0 1 0 1.8 2.43V7.5h2.2z"
      fill="#EE1D52"
      transform="translate(0.6, -0.4)"
    />
    {/* white main */}
    <path
      d="M20.5 7.5v10.2a5.7 5.7 0 1 1-4-5.45v3.18a2.55 2.55 0 1 0 1.8 2.43V7.5h2.2z"
      fill="#ffffff"
    />
  </svg>
);

/** YouTube — red badge */
export const YoutubeIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className}>
    <rect width="32" height="32" rx="8" fill="#FF0000" />
    <path
      d="M25.8 11.6a2.8 2.8 0 0 0-1.97-1.98C22.25 9.2 16 9.2 16 9.2s-6.25 0-7.83.42A2.8 2.8 0 0 0 6.2 11.6 29.3 29.3 0 0 0 5.8 16a29.3 29.3 0 0 0 .4 4.4A2.8 2.8 0 0 0 8.17 22.4C9.75 22.8 16 22.8 16 22.8s6.25 0 7.83-.4a2.8 2.8 0 0 0 1.97-1.97A29.3 29.3 0 0 0 26.2 16a29.3 29.3 0 0 0-.4-4.4z"
      fill="#FF0000"
    />
    <path d="M13.8 19.2V12.8l6.4 3.2-6.4 3.2z" fill="#ffffff" />
  </svg>
);

/** Pinterest — red badge */
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

