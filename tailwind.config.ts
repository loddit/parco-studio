import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#0ea5e9",
      },
      boxShadow: {
        panel: "0 18px 44px rgba(14, 165, 233, 0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
