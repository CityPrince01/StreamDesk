/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        card: "var(--bg-card)",
        hover: "var(--bg-hover)",
        track: "var(--bg-track)",
        line: "var(--border-card)",
        "line-input": "var(--border-input)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        "input-bg": "var(--input-bg)",
        "input-border": "var(--input-border)",
        "input-text": "var(--input-text)",
        success: "var(--text-success)",
        danger: "var(--text-danger)",
        warning: "var(--text-warning)",
        neutral: "var(--text-neutral)",
        "dot-success": "var(--dot-success)",
        "dot-danger": "var(--dot-danger)",
        "dot-warning": "var(--dot-warning)",
        "dot-neutral": "var(--dot-neutral)",
      },
      backgroundImage: {
        "brand-gradient": "var(--gradient-brand)",
        "revenue-gradient": "var(--gradient-revenue)",
      },
    },
  },
  plugins: [],
};
