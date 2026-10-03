/** 自制矢量卡背：深红皮革底、黄铜双框、角花与中央三龙纹章。无外部素材。 */
export function CardBackArt() {
  return <svg className="tda-back-art" viewBox="0 0 250 441" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="tdaBackField" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a1a16" /><stop offset=".5" stopColor="#2b0e0c" /><stop offset="1" stopColor="#3d1512" /></linearGradient>
      <linearGradient id="tdaBrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ead38f" /><stop offset=".5" stopColor="#b58a3a" /><stop offset="1" stopColor="#ead38f" /></linearGradient>
      <radialGradient id="tdaMedal" cx=".5" cy=".4" r=".6"><stop offset="0" stopColor="#6b2a22" /><stop offset="1" stopColor="#1e0907" /></radialGradient>
      <pattern id="tdaWeave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 3h6M3 0v6" stroke="#000" strokeOpacity=".18" strokeWidth=".6" /></pattern>
    </defs>
    <rect x="0" y="0" width="250" height="441" rx="14" fill="url(#tdaBackField)" />
    <rect x="0" y="0" width="250" height="441" rx="14" fill="url(#tdaWeave)" />
    <rect x="10" y="10" width="230" height="421" rx="9" fill="none" stroke="url(#tdaBrass)" strokeWidth="3" />
    <rect x="18" y="18" width="214" height="405" rx="6" fill="none" stroke="url(#tdaBrass)" strokeWidth="1" strokeOpacity=".8" />
    {[[18, 18, 1, 1], [232, 18, -1, 1], [18, 423, 1, -1], [232, 423, -1, -1]].map(([x, y, sx, sy], i) => (
      <g key={i} transform={`translate(${x} ${y}) scale(${sx} ${sy})`} fill="none" stroke="url(#tdaBrass)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M0 0c14 2 26 10 34 22M0 0c2 14 10 26 22 34M8 8c10 4 16 10 20 20" />
        <circle cx="12" cy="12" r="2.2" fill="#ead38f" stroke="none" />
      </g>
    ))}
    <circle cx="125" cy="220" r="78" fill="url(#tdaMedal)" stroke="url(#tdaBrass)" strokeWidth="3" />
    <circle cx="125" cy="220" r="68" fill="none" stroke="url(#tdaBrass)" strokeWidth="1" strokeDasharray="2 4" />
    <g fill="none" stroke="url(#tdaBrass)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
      {[0, 120, 240].map(angle => (
        <g key={angle} transform={`rotate(${angle} 125 220)`}>
          <path d="M125 164c-10 10-16 22-14 36 6-2 12-6 14-12 2 6 8 10 14 12 2-14-4-26-14-36z" fill="#2b0e0c" />
          <path d="M125 176l-4 14 4 6 4-6z" fill="#ead38f" stroke="none" />
          <path d="M111 200c-8 6-18 8-26 6 4 8 12 12 20 12" />
        </g>
      ))}
      <circle cx="125" cy="220" r="12" fill="#1e0907" />
      <path d="M125 211l7 9-7 9-7-9z" fill="#ead38f" stroke="none" />
    </g>
    <g fill="none" stroke="url(#tdaBrass)" strokeWidth="1.2" strokeOpacity=".9">
      <path d="M60 70h130M60 371h130" />
      <path d="M125 60l6 10-6 10-6-10zM125 361l6 10-6 10-6-10z" fill="#ead38f" />
    </g>
  </svg>;
}
