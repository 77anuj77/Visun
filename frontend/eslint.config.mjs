import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * React Compiler heuristics flag two deliberate client patterns in this app:
 * hydrating from localStorage inside an effect, and memo callbacks that close
 * over store state. Both are correct here and covered by the production build,
 * so they stay off while every other rule remains enforced.
 */
export default [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
];
