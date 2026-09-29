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
      /* Official Buffer mark: stacked layers (black) */
      return (
        <svg {...common} viewBox="0 0 24 24" fill="#0D0D0D">
          <path d="M12 2.4L3.6 6.3c-.4.2-.4.6 0 .8L12 11l8.4-3.9c.4-.2.4-.6 0-.8L12 2.4z" />
          <path d="M3.6 11.1c-.4.2-.4.6 0 .8L12 15.8l8.4-3.9c.4-.2.4-.6 0-.8L12 14.1 3.6 11.1z" opacity="0.85" />
          <path d="M3.6 15.9c-.4.2-.4.6 0 .8L12 20.6l8.4-3.9c.4-.2.4-.6 0-.8L12 18.9 3.6 15.9z" opacity="0.7" />
        </svg>
      );
    case "ideogram":
      /* Ideogram mark: brain with speed lines */
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
    /* Official Gmail product mark (Google brand colors) */
    case "gmail":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22 6.5v11c0 1.1-.9 2-2 2h-2V8.3l-6 4.5-6-4.5V19.5H4c-1.1 0-2-.9-2-2v-11c0-.55.22-1.05.59-1.41L12 11.5l9.41-6.41c.37.36.59.86.59 1.41z" />
          <path fill="#EA4335" d="M2.59 5.09C2.22 5.45 2 5.95 2 6.5v.37l8.5 6.37L2.59 5.09z" />
          <path fill="#FBBC04" d="M22 6.87V6.5c0-.55-.22-1.05-.59-1.41L12 12.24l1.5 1.12L22 6.87z" />
          <path fill="#34A853" d="M2 6.87v11.13c0 1.1.9 2 2 2h2V8.3L2 6.87z" />
          <path fill="#C5221F" d="M20 19.5h-2V8.3l-6 4.5V20h8c1.1 0 2-.9 2-2v-.5h-2z" />
        </svg>
      );
    /* Official Google Drive product mark */
    case "gdrive":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M4.433 22l3.52-6.087L15.482 2H8.045L.962 14.304 4.433 22z" />
          <path fill="#0066DA" d="M8.045 2L15.482 2 22.55 14.087 15.118 14.087z" />
          <path fill="#00AC47" d="M4.433 22H19.55l-3.52-6.087H.913z" />
          <path fill="#00832D" d="M8.045 2L4.433 8.174 15.118 14.087 18.73 7.913z" />
          <path fill="#FFBA00" d="M15.118 14.087L19.55 22H4.433l3.52-6.087z" />
          <path fill="#FFBB00" d="M22.55 14.087L19.55 22l-4.432-7.913z" />
        </svg>
      );
    /* Official Google Calendar product mark */
    case "gcal":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path fill="#FFFFFF" d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
          <path fill="#1A73E8" d="M19 3h-1V2h-2v1H8V2H6v1H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
          <path fill="#EA4335" d="M5 3h14c1.1 0 2 .9 2 2v2H3V5c0-1.1.9-2 2-2z" />
          <text
            x="12"
            y="16.2"
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fontFamily="Arial, Helvetica, sans-serif"
            fill="#1A73E8"
          >
            31
          </text>
        </svg>
      );
    /* Official Google Sheets product mark */
    case "gsheets":
      return (
        <svg {...common} viewBox="0 0 24 24">
          <path fill="#0F9D58" d="M14.5 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7.5L14.5 2z" />
          <path fill="#87CEAC" d="M14 2v5h5l-5-5z" />
          <path fill="#FFFFFF" d="M7.5 11h9v1.5h-9V11zm0 3h9v1.5h-9V14zm0 3h6V18.5h-6V17z" />
          <path fill="#FFFFFF" fillOpacity="0.9" d="M7.5 11h1.5v8.5H7.5V11zm4 0h1.5v8.5H11.5V11z" />
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
      /* Nexa Vault: purple hexagon with keyhole */
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
    default:
      return (
        <span
          className={`inline-flex items-center justify-center font-semibold ${className}`}
          style={{ width: s, height: s, fontSize: s * 0.4 }}
        >
          ?
        </span>
      );
  }
}
