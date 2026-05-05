module.exports = {
  // Custom
  printWidth: 120,
  trailingComma: "es5",
  plugins: ["@ianvs/prettier-plugin-sort-imports"],
  importOrder: ["<THIRD_PARTY_MODULES>", "", "^[.]"],
  importOrderTypeScriptVersion: "5.0.0",
  importOrderCaseSensitive: true,
};
