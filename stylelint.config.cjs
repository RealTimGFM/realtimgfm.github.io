module.exports = {
  extends: ["stylelint-config-standard"],
  rules: {
    // Allow BEM style: block__element--modifier
    "selector-class-pattern": [
      "^[a-z0-9]+(?:-[a-z0-9]+)*(?:__(?:[a-z0-9]+(?:-[a-z0-9]+)*))?(?:--(?:[a-z0-9]+(?:-[a-z0-9]+)*))*$",
      { message: "Use kebab-case or BEM (block__element--modifier)." },
    ],

    // Your site uses #themeToggle (camelCase). Either disable or enforce a pattern.
    // Allow any id naming you already use:
    "selector-id-pattern": null,

    // These are common false-positives in hand-written portfolio CSS:
    "no-descending-specificity": null,
  },
};
