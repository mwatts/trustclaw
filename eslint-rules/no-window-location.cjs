// @ts-nocheck
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow window.location for navigation in favor of Next.js useRouter",
      category: "Best Practices",
    },
    messages: {
      noWindowLocationAssign:
        "Use useRouter() from 'next/navigation' instead of window.location for programmatic navigation.",
      noWindowLocationHref:
        "Use useRouter().push() from 'next/navigation' instead of setting window.location.href.",
    },
    schema: [],
  },
  create(context) {
    return {
      // Catch window.location.assign() and window.location.replace()
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "MemberExpression" &&
          node.callee.object.object.type === "Identifier" &&
          node.callee.object.object.name === "window" &&
          node.callee.object.property.type === "Identifier" &&
          node.callee.object.property.name === "location" &&
          node.callee.property.type === "Identifier" &&
          ["assign", "replace", "reload"].includes(node.callee.property.name)
        ) {
          context.report({
            node,
            messageId: "noWindowLocationAssign",
          });
        }
      },
      // Catch window.location.href = ... and window.location = ...
      AssignmentExpression(node) {
        // window.location = "..."
        if (
          node.left.type === "MemberExpression" &&
          node.left.object.type === "Identifier" &&
          node.left.object.name === "window" &&
          node.left.property.type === "Identifier" &&
          node.left.property.name === "location"
        ) {
          context.report({
            node,
            messageId: "noWindowLocationHref",
          });
        }

        // window.location.href = "..."
        if (
          node.left.type === "MemberExpression" &&
          node.left.object.type === "MemberExpression" &&
          node.left.object.object.type === "Identifier" &&
          node.left.object.object.name === "window" &&
          node.left.object.property.type === "Identifier" &&
          node.left.object.property.name === "location" &&
          node.left.property.type === "Identifier" &&
          node.left.property.name === "href"
        ) {
          context.report({
            node,
            messageId: "noWindowLocationHref",
          });
        }
      },
    };
  },
};
