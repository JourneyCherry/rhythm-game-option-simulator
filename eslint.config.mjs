// eslint.config.mjs
import globals from "globals";

export default [
    {
        files: ["**/*.js", "**/*.mjs"],
        ignores: ["node_modules/**"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off",
            "no-undef": "error",
            "no-var": "error",
        },
    },
];
