/** 卡背：真实皮革照片（CC0）+ 平涂两色三龙纹章。无渐变。 */
const LEATHER = new URL("../assets/textures/brown_leather/color.webp", import.meta.url).href;

export function CardBackArt() {
  return <>
    <img className="tda-back-leather" src={LEATHER} alt="" draggable={false} decoding="async" />
    <svg className="tda-back-art" viewBox="0 0 250 441" aria-hidden="true" focusable="false">
      <rect x="11" y="11" width="228" height="419" rx="7" fill="none" stroke="#c9a24d" strokeWidth="2.5" />
      <rect x="19" y="19" width="212" height="403" rx="5" fill="none" stroke="#c9a24d" strokeWidth="1" strokeOpacity=".7" />
      <circle cx="125" cy="220" r="70" fill="#1e100b" stroke="#c9a24d" strokeWidth="2.5" />
      <circle cx="125" cy="220" r="60" fill="none" stroke="#c9a24d" strokeWidth="1" strokeOpacity=".7" />
      <g fill="#c9a24d">
        {[0, 120, 240].map(angle => (
          <g key={angle} transform={`rotate(${angle} 125 220)`}>
            <path d="M125 168c-9 9-15 20-13 33 5-2 10-5 13-10 3 5 8 8 13 10 2-13-4-24-13-33z" />
            <path d="M112 203c-7 5-16 7-24 5 4 7 11 11 19 11z" fillOpacity=".9" />
          </g>
        ))}
        <circle cx="125" cy="220" r="7" fill="#1e100b" stroke="#c9a24d" strokeWidth="1.5" />
      </g>
      <g fill="none" stroke="#c9a24d" strokeWidth="1.2" strokeOpacity=".85">
        <path d="M70 70h110M70 371h110" />
        <path d="M125 61l5 9-5 9-5-9zM125 362l5 9-5 9-5-9z" fill="#c9a24d" />
      </g>
    </svg>
  </>;
}
