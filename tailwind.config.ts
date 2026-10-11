import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        servigaz: {
          navy: {
            DEFAULT: "#0F2C59",
            light: "#1A3E72",
            dark: "#0A1F3F",
          },
          orange: {
            DEFAULT: "#F06529",
            light: "#FF7B42",
            dark: "#D94E15",
          },
          accent: "#2A75D3",
        },
      },
    },
  },
  plugins: [],
};
export default config;
