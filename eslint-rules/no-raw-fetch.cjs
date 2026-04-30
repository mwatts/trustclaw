// @ts-nocheck
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow raw fetch() calls in client code",
      category: "Best Practices",
    },
    messages: {
      noRawFetch:
        "Use tRPC (trpc.*.useQuery/useMutation) or Apollo generated hooks instead of raw fetch(). See CLAUDE.md for API call patterns.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check for fetch() calls
        if (node.callee.type === "Identifier" && node.callee.name === "fetch") {
          context.report({
            node,
            messageId: "noRawFetch",
          });
        }

        // Check for window.fetch() calls
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "window" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "fetch"
        ) {
          context.report({
            node,
            messageId: "noRawFetch",
          });
        }
      },
    };
  },
};
