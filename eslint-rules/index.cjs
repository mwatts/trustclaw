// @ts-nocheck
module.exports = {
  rules: {
    "require-hydrate-client": require("./require-hydrate-client.cjs"),
    "no-anchor-tags": require("./no-anchor-tags.cjs"),
    "no-window-location": require("./no-window-location.cjs"),
    "no-raw-fetch": require("./no-raw-fetch.cjs"),
    "single-component-per-file": require("./single-component-per-file.cjs"),
    "no-type-assertion": require("./no-type-assertion.cjs"),
    "no-hardcoded-colors": require("./no-hardcoded-colors.cjs"),
  },
};
