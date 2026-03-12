/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gold: {
          400: "#f5c842",
          500: "#d4a017",
          600: "#b8860b",
        },
        silver: {
          400: "#c0c0c0",
          500: "#a8a8a8",
          600: "#909090",
        },
      },
    },
  },
  plugins: [],
};
