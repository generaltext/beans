// The Beans logo mark — two solid coffee beans (one lying, one upright) with their
// signature offset seams. The seams are knocked out via fill-rule="evenodd", so the
// whole mark is a single tint that recolors cleanly wherever General Text places it
// (the seam shows whatever is behind the icon). Uses currentColor to inherit the
// surrounding text color / theme tint.
export function BeansMark({ className }: { className?: string }) {
  const BEAN =
    'M0,-7 C2.54,-7 4.6,-3.87 4.6,0 C4.6,3.87 2.54,7 0,7 C-2.54,7 -4.6,3.87 -4.6,0 C-4.6,-3.87 -2.54,-7 0,-7 Z M0.5,-4.9 C2.3,-2.8 2.3,2.9 0.5,5 C1.55,2.9 1.55,-2.8 0.5,-4.9 Z'
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" className={className} aria-hidden="true">
      <g transform="translate(0.4 1.6)">
        <path transform="translate(15.2 10) rotate(-11) scale(0.92)" d={BEAN} />
        <path transform="translate(8 15.2) rotate(-64) scale(0.82)" d={BEAN} />
      </g>
    </svg>
  )
}
