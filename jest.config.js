/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(ts|tsx)$": [
      "babel-jest",
      {
        configFile: "./babel.config.cjs",
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
