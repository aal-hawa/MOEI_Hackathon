import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [{
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    "@typescript-eslint/no-require-imports": "off",
    "@typescript-eslint/unbound-method": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/rules-of-hooks": "off",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    
    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
    
    // Import rules
    "import/no-extraneous-dependencies": "off",
    
    // Next.js rules (kept for compatibility with existing disable comments)
    "@next/internal/no-ambiguous-jsx": "off",
    
    // Regex rules
    "redos-detector/no-unsafe-regex": "off",
  },
}, {
  ignores: [
    "node_modules/**",
    "dist/**",
    "build/**",
    "examples/**",
    "skills/**",
    ".wrangler/**",
    "mini-services/worker-service/node_modules/**",
    "prisma/**",
    "db/**",
    "upload/**",
    "uploads/**",
    "download/**",
    "agent-ctx/**",
  ]
}];

export default eslintConfig;
