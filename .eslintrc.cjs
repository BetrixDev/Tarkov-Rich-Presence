module.exports = {
  rules: {
    "@typescript-eslint/explicit-function-return-type": 0,
    "@typescript-eslint/no-unsafe-declaration-merging": 0,
    "no-case-declarations": 0,
    "react/prop-types": 0,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "@electron-toolkit/eslint-config-ts/recommended",
    "@electron-toolkit/eslint-config-prettier",
  ],
};
