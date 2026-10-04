/** Brand marks for connectors — consistent 20–24px tile. */

export function ConnectorLogo({
  id,
  size = 24,
  className = "",
}: {
  id: string;
  size?: number;
  className?: string;
}) {
  const s = size;
  const common = { width: s, height: s, className, "aria-hidden": true as const };

  switch (id) {
    case "notion":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.38 2.397c-.56-.42-1.306-.793-2.428-.746L3.443 2.817c-.466.046-.56.28-.373.466l1.39.925zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.98-.56.98-1.167V6.354c0-.606-.233-.933-.746-.887l-15.177.887c-.56.046-.793.373-.793.933zm14.337.653c.093.42 0 .84-.42.888l-.7.14v10.264c-.606.327-1.163.514-1.626.514-.746 0-.933-.234-1.49-.933l-4.577-7.186v6.952c.14.514.046.84-.373.887l-1.026.233c-.42.093-.746-.187-.746-.56V9.55c0-.42.187-.793.606-.84l1.4-.186 4.9 7.466V8.83c.14-.514.56-.747.98-.7l.98.14z" />
        </svg>
      );
    case "slack":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path fill="#E01E5A" d="M5.04 15.16a2.04 2.04 0 1 1-2.04-2.04h2.04v2.04zm1.02 0a2.04 2.04 0 1 1 4.08 0v5.1a2.04 2.04 0 1 1-4.08 0v-5.1z" />
          <path fill="#36C5F0" d="M8.86 5.04a2.04 2.04 0 1 1 2.04-2.04v2.04H8.86zm0 1.02a2.04 2.04 0 1 1 0 4.08h-5.1a2.04 2.04 0 1 1 0-4.08h5.1z" />
          <path fill="#2EB67D" d="M18.96 8.86a2.04 2.04 0 1 1 2.04 2.04h-2.04V8.86zm-1.02 0a2.04 2.04 0 1 1-4.08 0V3.76a2.04 2.04 0 1 1 4.08 0v5.1z" />
          <path fill="#ECB22E" d="M15.14 18.96a2.04 2.04 0 1 1-2.04 2.04v-2.04h2.04zm0-1.02a2.04 2.04 0 1 1 0-4.08h5.1a2.04 2.04 0 1 1 0 4.08h-5.1z" />
        </svg>
      );
    case "buffer":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="#0D0D0D">
          <path d="M12 2.4L3.6 6.3c-.4.2-.4.6 0 .8L12 11l8.4-3.9c.4-.2.4-.6 0-.8L12 2.4z" />
          <path d="M3.6 11.1c-.4.2-.4.6 0 .8L12 15.8l8.4-3.9c.4-.2.4-.6 0-.8L12 14.1 3.6 11.1z" opacity="0.85" />
          <path d="M3.6 15.9c-.4.2-.4.6 0 .8L12 20.6l8.4-3.9c.4-.2.4-.6 0-.8L12 18.9 3.6 15.9z" opacity="0.7" />
        </svg>
      );
    case "hubspot":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none">
          <path
            fill="#FF7A59"
            d="M18.5 9.5c-.3 0-.6 0-.9.1V7.3c.9-.3 1.5-1.1 1.5-2.1 0-1.2-1-2.2-2.2-2.2S14.7 4 14.7 5.2c0 .9.5 1.6 1.3 2v2.4c-.8.4-1.4 1.1-1.6 2H7.2c-.2-.5-.5-.9-.9-1.2V8.1c.7-.3 1.2-1 1.2-1.8 0-1.1-.9-2-2-2s-2 .9-2 2c0 .8.5 1.5 1.2 1.8v2.3c-.9.5-1.5 1.5-1.5 2.6 0 1.4 1 2.6 2.3 2.9v3.4c-.7.3-1.2 1-1.2 1.8 0 1.1.9 2 2 2s2-.9 2-2c0-.8-.5-1.5-1.2-1.8v-3.3c.4.1.8.1 1.2.1h7.3c.2.6.6 1.1 1.1 1.4v2.5c-.7.3-1.2 1-1.2 1.8 0 1.1.9 2 2 2s2-.9 2-2c0-.8-.5-1.5-1.2-1.8v-2.6c1.1-.5 1.9-1.6 1.9-2.9 0-1.7-1.4-3.1-3.1-3.1zm-1.6-5.1c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7zM5.5 6.3c0-.4.3-.7.7-.7s.7.3.7.7-.3.7-.7.7-.7-.3-.7-.7zm.7 11.9c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm5.3-3.6H7.2c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5h7.3c.2 0 .3 0 .5.1-.1.4-.1.7-.1 1.1 0 .7.2 1.3.5 1.8h-3.9zm5.4 3.6c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7zm0-5.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"
          />
        </svg>
      );
    case "ideogram":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none">
          <g fill="#0D0D0D" stroke="#0D0D0D" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 8.5h3.5" fill="none" />
            <path d="M2 12h4" fill="none" />
            <path d="M2.5 15.5h3.5" fill="none" />
            <path
              fill="#0D0D0D"
              stroke="none"
              d="M14.2 4.2c-1.1 0-2.1.4-2.85 1.05A3.9 3.9 0 0 0 9.2 4.5c-2.1 0-3.8 1.7-3.8 3.8 0 .5.1 1 .28 1.45A3.3 3.3 0 0 0 4.2 12.5c0 1.7 1.25 3.1 2.9 3.4v1.9c0 .6.5 1.1 1.1 1.1h.9c.6 0 1.1-.5 1.1-1.1v-.7h1.6v.7c0 .6.5 1.1 1.1 1.1h.9c.6 0 1.1-.5 1.1-1.1v-1.85c1.75-.4 3-1.9 3-3.7 0-1.1-.45-2.05-1.2-2.75.15-.45.25-.95.25-1.45 0-2.2-1.8-4-4.05-4z"
            />
            <path d="M9.8 9.2c.6-.5 1.3-.7 2.1-.7" fill="none" stroke="#fff" strokeWidth="1.1" />
            <path d="M9.5 12.2c.8-.3 1.6-.3 2.4 0" fill="none" stroke="#fff" strokeWidth="1.1" />
            <path d="M13.8 9.5c.5.4.8 1 .8 1.7" fill="none" stroke="#fff" strokeWidth="1.1" />
          </g>
        </svg>
      );
    case "github":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      );
    case "gmail":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none">
          <path fill="#EA4335" d="M2 6.5A2.5 2.5 0 0 1 4.5 4h15A2.5 2.5 0 0 1 22 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 17.5v-11z" opacity="0.15" />
          <path fill="#EA4335" d="M3 7l9 6 9-6" stroke="#EA4335" strokeWidth="1.5" fill="none" />
          <path d="M3 7v10.5A1.5 1.5 0 0 0 4.5 19h15a1.5 1.5 0 0 0 1.5-1.5V7L12 13 3 7z" fill="#EA4335" opacity="0.9" />
          <path d="M3 7l9 6 9-6H3z" fill="#C5221F" />
        </svg>
      );
    case "gdrive":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none">
          <path d="M8.5 4h7l5.5 9.5H14L8.5 4z" fill="#0F9D58" />
          <path d="M3 13.5L8.5 4 14 13.5H3z" fill="#FFCD40" />
          <path d="M3 13.5h11l3 5.5H6L3 13.5z" fill="#4285F4" />
        </svg>
      );
    case "gcal":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="18" height="16" rx="2" fill="#1A73E8" />
          <path d="M3 9h18" stroke="#fff" strokeWidth="1.2" />
          <path d="M8 3v4M16 3v4" stroke="#1A73E8" strokeWidth="1.5" strokeLinecap="round" />
          <text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="system-ui,sans-serif">
            31
          </text>
        </svg>
      );
    case "gsheets":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="2" width="16" height="20" rx="2" fill="#0F9D58" />
          <path d="M7 8h10M7 12h10M7 16h10M10 8v8M14 8v8" stroke="#fff" strokeWidth="1.2" />
        </svg>
      );
    case "local_data":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <ellipse cx="12" cy="6" rx="7" ry="3" />
          <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
          <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
        </svg>
      );
    case "local_comfyui":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <circle cx="12" cy="11" r="3" />
          <path d="M3 18h18" />
        </svg>
      );
    case "vault":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none">
          <path
            fill="#5B5CF0"
            d="M12 1.8L3.8 6.3v11.4L12 22.2l8.2-4.5V6.3L12 1.8z"
          />
          <path
            fill="#fff"
            d="M12 8.2c-1.45 0-2.6 1.15-2.6 2.6 0 .9.45 1.7 1.2 2.15v3.35c0 .45.35.8.8.8h1.2c.45 0 .8-.35.8-.8v-3.35c.75-.45 1.2-1.25 1.2-2.15 0-1.45-1.15-2.6-2.6-2.6zm0 1.5c.6 0 1.1.5 1.1 1.1S12.6 11.9 12 11.9s-1.1-.5-1.1-1.1.5-1.1 1.1-1.1z"
          />
        </svg>
      );
    case "mcp":
      return (
        <svg {...common} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#5B5CF0" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#818CF8" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#818CF8" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" fill="#5B5CF0" />
          <path
            d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4"
            stroke="#5B5CF0"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <span
          className={`inline-flex items-center justify-center font-semibold text-zinc-500 ${className}`}
          style={{ width: s, height: s, fontSize: Math.max(10, s * 0.35) }}
        >
          {(id || "?").slice(0, 1).toUpperCase()}
        </span>
      );
  }
}
