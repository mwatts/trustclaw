// @ts-nocheck
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow <a> tags in favor of Next.js Link",
      category: "Best Practices",
    },
    messages: {
      noAnchorTags:
        "Use Next.js <Link> from '~/components/tracked' instead of <a> tags for proper routing and analytics.",
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type === "JSXIdentifier" && node.name.name === "a") {
          context.report({
            node,
            messageId: "noAnchorTags",
          });
        }
      },
    };
  },
};
