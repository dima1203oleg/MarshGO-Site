type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'h-9 w-9 rounded-xl',
  md: 'h-12 w-12 rounded-2xl',
  lg: 'h-[4.4rem] w-[4.4rem] rounded-[1.4rem]',
} satisfies Record<NonNullable<BrandMarkProps['size']>, string>;

/** Shared MARSHGO app mark used by the web and Capacitor iOS shell. */
export function BrandMark({ size = 'md', className = '' }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-grid shrink-0 place-items-center bg-gradient-to-br from-[#2690ff] via-[#0870ef] to-[#0750c8] text-white shadow-[0_6px_16px_rgba(23,105,244,.24)] ${sizeClasses[size]} ${className}`}
    >
      <svg viewBox="0 0 40 40" className="h-[68%] w-[68%]" fill="none">
        <path d="M7 29V12.8c0-1.7 2-2.5 3.2-1.3L20 21l9.8-9.5c1.2-1.2 3.2-.4 3.2 1.3V29" stroke="currentColor" strokeWidth="5.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="28.5" r="2.5" fill="currentColor" />
      </svg>
    </span>
  );
}
