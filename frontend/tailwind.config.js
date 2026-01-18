/** @type {import('tailwindcss').Config} */
import medusaPreset from "@medusajs/ui-preset";
import typography from "@tailwindcss/typography";

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@medusajs/ui/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  presets: [medusaPreset],
  theme: {
    extend: {},
  },
  plugins: [typography],
}

