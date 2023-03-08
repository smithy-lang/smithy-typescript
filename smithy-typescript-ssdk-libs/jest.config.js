const base = require("./jest.config.base.js");

module.exports = {
  ...base,
  projects: ["<rootDir>/*/jest.config.js"]
};
