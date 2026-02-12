/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#002349",
        "background-light": "#F3F4F6",
        "background-dark": "#0B0E14",
        gold: "#C29B40",
        "accent-grey": "#999999",
        "text-grey": "#666666",
      },
      fontFamily: {
        display: ["var(--font-display)", "Amiri", "serif"],
        sans: ["var(--font-sans)", "Source Sans 3", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};