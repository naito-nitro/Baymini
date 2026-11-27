interface BayminiLogoProps {
  compact?: boolean;
}

export function BayminiLogo({ compact = false }: BayminiLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width={compact ? 26 : 30}
        height={compact ? 26 : 30}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect
          width="32"
          height="32"
          rx="9"
          fill="var(--bm-primary)"
        />
        <path
          d="M11.25 9.25H17.1C19.35 9.25 20.9 10.5 20.9 12.45C20.9 13.8 20.08 14.85 18.82 15.32C20.42 15.78 21.45 17.02 21.45 18.68C21.45 21.02 19.62 22.75 16.95 22.75H11.25V9.25ZM13.65 14.6H16.65C17.8 14.6 18.52 13.98 18.52 12.95C18.52 11.95 17.8 11.35 16.65 11.35H13.65V14.6ZM13.65 20.62H16.85C18.18 20.62 19.02 19.9 19.02 18.62C19.02 17.35 18.18 16.65 16.85 16.65H13.65V20.62Z"
          fill="var(--bm-primary-foreground)"
        />
      </svg>
      <span
        className={`font-semibold tracking-tight text-bm-text ${
          compact ? 'text-[15px]' : 'text-[17px]'
        }`}
      >
        Baymini
      </span>
    </span>
  );
}
