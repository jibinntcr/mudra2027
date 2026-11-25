import React from 'react';

interface MudraLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  subtitle?: string;
  theme?: 'light' | 'dark';
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
};

/**
 * Official Mudra Publications Emblem & Brand Lockup
 * Uses `/mudrapublications_logo.jpeg` across headers, footers, sign-in screens, PDF reader toolbars, and mobile app bars.
 */
export function MudraBrandLogo({
  size = 'md',
  showText = true,
  subtitle = 'മുദ്ര പബ്ലിക്കേഷൻസ് • Kerala Registration & LRC Library',
  theme = 'light',
  className = '',
}: MudraLogoProps) {
  const imgSizeClass = SIZE_CLASSES[size];
  const titleColor = theme === 'dark' ? 'text-white' : 'text-mudra-950';
  const subColor = theme === 'dark' ? 'text-amber-300/90' : 'text-mudra-700';

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        className={`relative shrink-0 overflow-hidden rounded-full bg-[#0b192c] ring-2 ring-amber-400/70 shadow-md ${imgSizeClass}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/mudrapublications_logo.jpeg"
          alt="Mudra Publications Official Logo"
          width={100}
          height={100}
          className="h-full w-full object-cover scale-105"
          decoding="async"
        />
      </div>

      {showText && (
        <div className="min-w-0">
          <span
            className={`block font-serif text-base sm:text-lg font-bold tracking-tight leading-tight truncate ${titleColor}`}
          >
            Mudra Publications
          </span>
          {subtitle && (
            <span className={`block text-[11px] sm:text-xs truncate mt-0.5 ${subColor}`}>
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
