type IconProps = {
  className?: string;
};

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15A1.65 1.65 0 0 0 19.73 16.87L19.79 16.93A2 2 0 0 1 17 19.73L16.94 19.67A1.65 1.65 0 0 0 15.07 19.34A1.65 1.65 0 0 0 14 20.5V21A2 2 0 1 1 10 21V20.5A1.65 1.65 0 0 0 8.93 19.34A1.65 1.65 0 0 0 7.06 19.67L7 19.73A2 2 0 1 1 4.2 16.93L4.26 16.87A1.65 1.65 0 0 0 4.59 15A1.65 1.65 0 0 0 3.5 14H3A2 2 0 1 1 3 10H3.5A1.65 1.65 0 0 0 4.59 8.93A1.65 1.65 0 0 0 4.26 7.06L4.2 7A2 2 0 1 1 7 4.2L7.06 4.26A1.65 1.65 0 0 0 8.93 4.59A1.65 1.65 0 0 0 10 3.5V3A2 2 0 1 1 14 3V3.5A1.65 1.65 0 0 0 15.07 4.59A1.65 1.65 0 0 0 16.94 4.26L17 4.2A2 2 0 1 1 19.8 7L19.74 7.06A1.65 1.65 0 0 0 19.41 8.93A1.65 1.65 0 0 0 20.5 10H21A2 2 0 1 1 21 14H20.5A1.65 1.65 0 0 0 19.4 15Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4 20C4.55 16.27 7.73 13.5 12 13.5C16.27 13.5 19.45 16.27 20 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function KeyIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 11V8C7 5.79 8.79 4 11 4H13C15.21 4 17 5.79 17 8V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4.5C9.52 4.5 7.5 6.52 7.5 9V11.5L5.5 14.5V15.5H18.5V14.5L16.5 11.5V9C16.5 6.52 14.48 4.5 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M10 18.5C10.28 19.44 11.06 20 12 20C12.94 20 13.72 19.44 14 18.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SunIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 3V5M12 19V21M3 12H5M19 12H21M5.6 5.6L7 7M17 17L18.4 18.4M5.6 18.4L7 17M17 7L18.4 5.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 5.5C5 4.67 5.67 4 6.5 4H11V20H6.5C5.67 20 5 19.33 5 18.5V5.5Z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 4H17.5C18.33 4 19 4.67 19 5.5V18.5C19 19.33 18.33 20 17.5 20H11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4L5 7V12C5 16.42 8.03 20.34 12 21.5C15.97 20.34 19 16.42 19 12V7L12 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function CardIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 11V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="8.5" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function HelpIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4L4 8.5V12C4 16.1 7.2 19.7 12 20.5C16.8 19.7 20 16.1 20 12V8.5L12 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 11V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="9" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10 7V6C10 4.9 10.9 4 12 4H17C18.1 4 19 4.9 19 6V18C19 19.1 18.1 20 17 20H12C10.9 20 10 19.1 10 18V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 12H14M14 12L11 9M14 12L11 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
