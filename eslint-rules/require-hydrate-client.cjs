// @ts-nocheck
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require HydrateClient wrapper when using prefetch in page components",
      category: "Best Practices",
    },
    messages: {
      missingHydrateClient:
        "Pages using prefetch() or prefetchQuery() must wrap children in <HydrateClient> for the cache to hydrate correctly. Import HydrateClient from '~/clients/trpc/server'.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();

    if (!filename.endsWith("page.tsx")) {
      return {};
    }

    let hasPrefetchCall = false;
    let hasHydrateClientJsx = false;

    return {
      CallExpression(node) {
        // Check for .prefetch() method calls (tRPC pattern)
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "prefetch"
        ) {
          hasPrefetchCall = true;
        }

        // Check for prefetchQuery() function calls (Apollo pattern)
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "prefetchQuery"
        ) {
          hasPrefetchCall = true;
        }

        // Check for *.prefetchQuery() method calls (e.g., apolloServer.prefetchQuery())
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "prefetchQuery"
        ) {
          hasPrefetchCall = true;
        }
      },
      JSXElement(node) {
        if (
          node.openingElement.name.type === "JSXIdentifier" &&
          node.openingElement.name.name === "HydrateClient"
        ) {
          hasHydrateClientJsx = true;
        }
      },
      "Program:exit"(node) {
        if (hasPrefetchCall && !hasHydrateClientJsx) {
          context.report({
            node,
            messageId: "missingHydrateClient",
          });
        }
      },
    };
  },
};
