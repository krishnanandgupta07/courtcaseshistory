/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1C2B4A',
        navyDeep: '#121D33',
        parchment: '#F6F1E6',
        parchmentDim: '#EDE5D3',
        burgundy: '#8B2635',
        brass: '#AD8A4E',
        brassLight: '#D9C495',
        sage: '#52654A',
        ink: '#2A2620',
        inkSoft: '#6B6455',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        masthead: 'linear-gradient(135deg, #121D33 0%, #1C2B4A 55%, #243556 100%)',
      },
      boxShadow: {
        slip: '0 1px 0 rgba(28, 43, 74, 0.08), 0 8px 24px rgba(18, 29, 51, 0.06)',
      },
    },
  },
  plugins: [],
}

