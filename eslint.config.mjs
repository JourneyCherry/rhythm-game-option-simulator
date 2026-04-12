// eslint.config.mjs
export default [
    {
        files: ["**/*.js", "**/*.mjs"],
        languageOptions: {
            ecmaVersion: "latest",
            sourceType: "module",
            globals: {
                window: "readonly",
                document: "readonly",
                console: "readonly",
                ...globals.browser, // 브라우저 내장 API 전체 포함
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
