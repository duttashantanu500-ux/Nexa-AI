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
    /* Official Gmail product mark — from Google gstatic (2026) */
    case "gmail":
      return (
        <svg {...common} viewBox="0 0 192 192" fill="none">
<path fill="url(#gmail-a)" d="M146 44h38v110c0 6.627-5.373 12-12 12h-20a6 6 0 0 1-6-6z"/><path fill="#fc413d" d="M46 44H8v110c0 6.627 5.373 12 12 12h20a6 6 0 0 0 6-6z"/><path fill="url(#gmail-b)" d="M39.226 30.456c-8.033-6.752-20.018-5.714-26.77 2.319-6.752 8.032-5.714 20.017 2.319 26.77l76.078 63.949a8 8 0 0 0 10.295 0l76.078-63.95c8.032-6.752 9.07-18.737 2.318-26.77-6.752-8.032-18.737-9.07-26.769-2.318L96 78.18z"/><defs><linearGradient id="gmail-a" x1="165" x2="165" y1="44" y2="166" gradientUnits="userSpaceOnUse"><stop stop-color="#60d673"/><stop offset=".17" stop-color="#42c868"/><stop offset=".39" stop-color="#0ebc5f"/><stop offset=".62" stop-color="#00a9bb"/><stop offset=".86" stop-color="#3c90ff"/><stop offset="1" stop-color="#3186ff"/></linearGradient><linearGradient id="gmail-b" x1="8" x2="184" y1="46.13" y2="46.13" gradientUnits="userSpaceOnUse"><stop offset=".08" stop-color="#ff63a0"/><stop offset=".3" stop-color="#fc413d"/><stop offset=".5" stop-color="#fc413d"/><stop offset=".65" stop-color="#fc413d"/><stop offset=".72" stop-color="#fc5c30"/><stop offset=".86" stop-color="#feb10c"/><stop offset=".91" stop-color="#fec700"/><stop offset=".96" stop-color="#ffdb0f"/></linearGradient></defs>
        </svg>
      );
    /* Official Google Drive product mark — from Google gstatic (2026) */
    case "gdrive":
      return (
        <svg {...common} viewBox="0 0 192 192" fill="none">
<mask id="drive-a" width="168" height="154" x="12" y="18" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path fill="#b43333" d="M63.09 37c14.626-25.333 51.193-25.334 65.819 0l45.033 78c14.626 25.334-3.657 57.001-32.91 57.001H50.967c-29.253 0-47.536-31.667-32.91-57.001z"/></mask><g mask="url(#drive-a)"><path fill="url(#drive-b)" d="M206.905 172.02h-91.888l-19.015-32.934 45.944-79.578z"/><path fill="url(#drive-c)" d="M-14.919 172.006 50.04 59.494v.002L31.032 92.422h38.02L115 172.004l-129.918.001z"/><path fill="url(#drive-d)" d="M96.007-20.085 141.954 59.5l-19.011 32.928H31.048z"/></g><defs><linearGradient id="drive-b" x1="193.6" x2="103.09" y1="165.6" y2="111.21" gradientUnits="userSpaceOnUse"><stop offset=".09" stop-color="#ffe921"/><stop offset="1" stop-color="#fec700"/></linearGradient><linearGradient id="drive-c" x1="114.4" x2="15.53" y1="181.61" y2="121.8" gradientUnits="userSpaceOnUse"><stop offset=".15" stop-color="#a9a8ff"/><stop offset=".33" stop-color="#6d97ff"/><stop offset=".48" stop-color="#3186ff"/></linearGradient><linearGradient id="drive-d" x1="128.88" x2="28.7" y1="37.88" y2="84.64" gradientUnits="userSpaceOnUse"><stop offset=".55" stop-color="#0ebc5f"/><stop offset=".85" stop-color="#78c9ff"/></linearGradient></defs>
        </svg>
      );
    /* Official Google Calendar product mark — from Google gstatic (2026) */
    case "gcal":
      return (
        <svg {...common} viewBox="0 0 192 192" fill="none">
<path fill="#bbe2ff" d="M32 36.8C32 20.894 44.894 8 60.8 8h70.4C147.106 8 160 20.894 160 36.8v30.4c0 15.906-12.894 28.8-28.8 28.8H60.8C44.894 96 32 83.106 32 67.2z"/><path fill="#3c90ff" d="M19.867 49.392C17.818 33.82 29.94 20 45.645 20h100.71c15.706 0 27.827 13.82 25.778 29.392L166 96l6.133 46.608C174.182 158.18 162.061 172 146.355 172H45.645c-15.706 0-27.827-13.82-25.778-29.392L26 96z"/><mask id="calendar-a" width="154" height="152" x="19" y="20" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path fill="#3c90ff" d="M19.867 49.392C17.818 33.82 29.94 20 45.645 20h100.71c15.706 0 27.827 13.82 25.778 29.392L166 96l6.133 46.608C174.182 158.18 162.061 172 146.355 172H45.645c-15.706 0-27.827-13.82-25.778-29.392L26 96z"/></mask><g mask="url(#calendar-a)"><path fill="url(#calendar-b)" d="M0 0h166v76H0z" transform="matrix(1 0 0 -1 13 172)"/></g><mask id="calendar-c" width="154" height="152" x="19" y="20" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path fill="#3186ff" d="M19.867 49.392C17.818 33.82 29.94 20 45.645 20h100.71c15.706 0 27.827 13.82 25.778 29.392L166 96l6.133 46.608C174.182 158.18 162.061 172 146.355 172H45.645c-15.706 0-27.827-13.82-25.778-29.392L26 96z"/></mask><g mask="url(#calendar-c)"><path fill="url(#calendar-d)" d="M32 27.2C32 16.596 40.596 8 51.2 8h89.6c10.604 0 19.2 8.596 19.2 19.2V96H32z" filter="url(#calendar-e)"/></g><path fill="#fff" d="M75.353 133.336q-6.282 0-10.777-2.043t-7.61-5.465q-3.065-3.474-4.342-6.793T51.603 115a2.07 2.07 0 0 1 1.021-1.124l5.67-2.247q.714-.357 1.43-.102.714.204 1.685 2.349 1.022 2.145 2.86 4.546a14.3 14.3 0 0 0 4.495 3.728q2.606 1.328 6.435 1.328 6.18 0 9.807-3.575 3.677-3.575 3.677-9.091 0-5.976-3.882-9.194-3.881-3.269-10.266-3.269h-5.362a1.9 1.9 0 0 1-1.328-.51q-.51-.562-.511-1.277v-5.465q0-.767.51-1.277a1.82 1.82 0 0 1 1.329-.562h4.647q5.721 0 9.194-3.116t3.473-8.07q0-4.902-3.116-7.916t-8.58-3.014q-3.065 0-5.312 1.022a11.5 11.5 0 0 0-3.882 2.86 22.7 22.7 0 0 0-2.809 3.78q-1.174 1.941-1.89 2.145-.714.153-1.379-.255l-5.363-2.605q-.664-.358-.868-1.124t1.226-3.575q1.481-2.86 4.494-5.823a21 21 0 0 1 7.049-4.597q4.035-1.635 9.398-1.634 9.96 0 15.782 5.26 5.823 5.21 5.823 13.791 0 5.925-2.86 10.266-2.81 4.34-7.968 6.13v.204q6.231 1.838 9.806 6.741 3.627 4.853 3.626 11.594 0 9.654-6.742 15.834-6.74 6.18-17.57 6.18zm51.25-1.175q-.868 0-1.533-.664a2.25 2.25 0 0 1-.612-1.583V73.118l-11.492 8.274q-.614.46-1.431.307a1.96 1.96 0 0 1-1.225-.766l-3.32-4.7a1.98 1.98 0 0 1-.358-1.43q.153-.816.817-1.276l20.379-14.557q.256-.204.562-.306.307-.153.715-.153h4.291q.868 0 1.379.613.562.56.562 1.43v69.36q0 .92-.664 1.583a2 2 0 0 1-1.533.664z"/><defs><linearGradient id="calendar-b" x1="83" x2="83" y1="76" gradientUnits="userSpaceOnUse"><stop stop-color="#4fa0ff"/><stop offset="1" stop-color="#3186ff"/></linearGradient><linearGradient id="calendar-d" x1="89.06" x2="89.06" y1="21.75" y2="96.39" gradientUnits="userSpaceOnUse"><stop stop-color="#a9a8ff"/><stop offset=".8" stop-color="#3c90ff"/></linearGradient><filter id="calendar-e" width="152" height="112" x="20" y="-4" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_37330_7673" stdDeviation="6"/></filter></defs>
        </svg>
      );
    /* Official Google Sheets product mark — from Google gstatic (2026) */
    case "gsheets":
      return (
        <svg {...common} viewBox="0 0 192 192" fill="none">
<path fill="#009954" d="M8 74.6c0-8.943 0-13.415 1.404-16.962a20 20 0 0 1 11.234-11.233C24.185 45 28.656 45 37.6 45h60.8c8.943 0 13.415 0 16.962 1.404a20 20 0 0 1 11.234 11.234C128 61.185 128 65.656 128 74.6v42.8c0 8.943 0 13.415-1.404 16.962a20 20 0 0 1-11.234 11.234C111.815 147 107.343 147 98.4 147H37.6c-8.943 0-13.415 0-16.963-1.404a20 20 0 0 1-11.233-11.234C8 130.815 8 126.343 8 117.4z"/><mask id="sheets-a" width="160" height="128" x="24" y="32" maskUnits="userSpaceOnUse" style="mask-type:alpha"><rect width="160" height="128" x="24" y="32" fill="#0ebc5f" rx="20"/></mask><g mask="url(#sheets-a)"><path fill="#0ebc5f" d="M24 32h160v128H24z"/><g filter="url(#sheets-b)"><rect width="144" height="102" fill="url(#sheets-c)" rx="25.6" transform="matrix(1 0 0 -1 8 147)"/></g></g><path stroke="#fff" stroke-linecap="round" stroke-width="12" d="M80 121h84m-20 19V76"/><defs><linearGradient id="sheets-c" x1="122.24" x2="20.76" y1="43.31" y2="43.31" gradientUnits="userSpaceOnUse"><stop stop-color="#0ebc5f"/><stop offset=".95" stop-color="#78c9ff"/></linearGradient><filter id="sheets-b" width="168" height="126" x="-4" y="33" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_37435_8174" stdDeviation="6"/></filter></defs>
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
