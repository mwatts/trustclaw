// @ts-nocheck
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type assertions with 'as' in favor of 'satisfies' or Zod parsing",
      category: "Best Practices",
    },
    messages: {
      noTypeAssertion:
        "Avoid type assertions with 'as'. Use 'satisfies' for type checking or parse unknown data with Zod schemas.",
    },
    schema: [],
  },
  create(context) {
    return {
      TSAsExpression(node) {
        // Allow "as const" assertions
        if (
          node.typeAnnotation.type === "TSTypeReference" &&
          node.typeAnnotation.typeName.type === "Identifier" &&
          node.typeAnnotation.typeName.name === "const"
        ) {
          return;
        }

        context.report({
          node,
          messageId: "noTypeAssertion",
        });
      },
    };
  },
};
