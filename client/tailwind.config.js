/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        panel: '#0f172a',
        card: '#111827',
        accent: '#22d3ee',
        accentSoft: '#164e63',
        borderSoft: '#1f2937'
      },
      boxShadow: {
        glow: '0 0 40px rgba(34, 211, 238, 0.15)'
      }
    }
  },
  plugins: []
};
