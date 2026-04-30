// @ts-nocheck
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce one React component per file",
      category: "Best Practices",
    },
    messages: {
      multipleComponents:
        "Only one React component should be exported per file. Found {{count}} components: {{names}}",
    },
    schema: [],
  },
  create(context) {
    const exportedComponents = [];

    function isComponentName(name) {
      return name && /^[A-Z]/.test(name);
    }

    return {
      ExportNamedDeclaration(node) {
        if (node.declaration) {
          if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
            if (isComponentName(node.declaration.id.name)) {
              exportedComponents.push(node.declaration.id.name);
            }
          }
          if (node.declaration.type === "VariableDeclaration") {
            for (const decl of node.declaration.declarations) {
              if (decl.id.type === "Identifier" && isComponentName(decl.id.name)) {
                exportedComponents.push(decl.id.name);
              }
            }
          }
        }
      },
      ExportDefaultDeclaration(node) {
        if (node.declaration.type === "FunctionDeclaration" && node.declaration.id) {
          if (isComponentName(node.declaration.id.name)) {
            exportedComponents.push(node.declaration.id.name);
          }
        } else if (node.declaration.type === "Identifier") {
          if (isComponentName(node.declaration.name)) {
            exportedComponents.push(node.declaration.name);
          }
        }
      },
      "Program:exit"(node) {
        if (exportedComponents.length > 1) {
          context.report({
            node,
            messageId: "multipleComponents",
            data: {
              count: exportedComponents.length,
              names: exportedComponents.join(", "),
            },
          });
        }
      },
    };
  },
};
