interface LogoProps {
  size?: number
  className?: string
  /** 'icon' = square mark only (default), 'wordmark' = full text SVG */
  variant?: 'icon' | 'wordmark'
}

/** HapiEats TV brand logo */
export default function Logo({ size = 36, className, variant = 'icon' }: LogoProps) {
  if (variant === 'wordmark') {
    return (
      <svg
        width={size * 5}
        height={size}
        viewBox="0 0 180 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="HapiEats TV"
      >
        {/* HAPI — cyan */}
        <text
          x="2"
          y="28"
          fontFamily="'Arial Black', 'Impact', Arial, sans-serif"
          fontWeight="900"
          fontSize="26"
          fill="#22d3ee"
          letterSpacing="-0.5"
        >
          HAPI
        </text>
        {/* EATS — white */}
        <text
          x="74"
          y="28"
          fontFamily="'Arial Black', 'Impact', Arial, sans-serif"
          fontWeight="900"
          fontSize="26"
          fill="white"
          letterSpacing="-0.5"
        >
          EATS
        </text>
        {/* TV — hot pink, italic */}
        <text
          x="148"
          y="28"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight="bold"
          fontStyle="italic"
          fontSize="26"
          fill="#f0147e"
          letterSpacing="-0.5"
        >
          TV
        </text>
      </svg>
    )
  }

  // Icon variant (square mark)
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="HapiEats TV"
    >
      {/* Background */}
      <rect width="40" height="40" rx="9" fill="#06b6d4" />

      {/* Fork — left side */}
      <line x1="11" y1="9"  x2="11" y2="16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="14" y1="9"  x2="14" y2="16" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 16 Q12.5 18.5 14 16" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <line x1="12.5" y1="17.5" x2="12.5" y2="30" stroke="white" strokeWidth="1.8" strokeLinecap="round" />

      {/* Play triangle — right side */}
      <path d="M19.5 12.5 L30.5 20 L19.5 27.5 Z" fill="white" />
    </svg>
  )
}
