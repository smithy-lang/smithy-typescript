module.exports = {
  // Custom
  printWidth: 120,
  trailingComma: "es5",
  plugins: ["prettier-plugin-java"],
  overrides: [
    {
      files: "*.java",
      options: {
        tabWidth: 4,
      },
    },
  ],
};
