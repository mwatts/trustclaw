// @ts-nocheck
/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow hardcoded Tailwind color classes in favor of shadcn theme variables",
      category: "Best Practices",
    },
    messages: {
      noHardcodedColor:
        "Avoid hardcoded Tailwind color '{{match}}'. Use shadcn theme variables instead (e.g., bg-background, text-foreground, border-border, text-muted-foreground). See CLAUDE.md theming section.",
    },
    schema: [],
  },
  create(context) {
    const colors = [
      "slate", "gray", "zinc", "neutral", "stone",
      "red", "orange", "amber", "yellow", "lime",
      "green", "emerald", "teal", "cyan", "sky",
      "blue", "indigo", "violet", "purple", "fuchsia",
      "pink", "rose",
    ].join("|");

    const prefixes = [
      "bg", "text", "border", "ring", "divide", "outline",
      "shadow", "fill", "stroke", "placeholder", "caret",
      "accent", "decoration", "from", "to", "via",
    ].join("|");

    // Matches e.g. bg-red-500, text-gray-300, border-slate-200
    // Also matches hover:bg-red-500, dark:text-gray-300, etc. (the prefix before : is ignored)
    const pattern = new RegExp(
      `\\b(?:${prefixes})-(?:${colors})(?:-\\d{1,3})?\\b`,
      "g"
    );

    function checkStringForColors(node, value) {
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(value)) !== null) {
        context.report({
          node,
          messageId: "noHardcodedColor",
          data: { match: match[0] },
        });
      }
    }

    return {
      // Check className="..." string literals
      JSXAttribute(node) {
        if (
          node.name.type === "JSXIdentifier" &&
          node.name.name === "className"
        ) {
          // className="literal string"
          if (node.value && node.value.type === "Literal" && typeof node.value.value === "string") {
            checkStringForColors(node, node.value.value);
          }

          // className={"literal string"} or className={`template`}
          if (node.value && node.value.type === "JSXExpressionContainer") {
            const expr = node.value.expression;

            if (expr.type === "Literal" && typeof expr.value === "string") {
              checkStringForColors(node, expr.value);
            }

            if (expr.type === "TemplateLiteral") {
              for (const quasi of expr.quasis) {
                checkStringForColors(node, quasi.value.raw);
              }
            }
          }
        }
      },
      // Check string arguments in cn(), clsx(), cva(), twMerge() calls
      CallExpression(node) {
        const callee = node.callee;
        const isCnCall =
          (callee.type === "Identifier" && ["cn", "clsx", "cva", "twMerge"].includes(callee.name));

        if (!isCnCall) return;

        for (const arg of node.arguments) {
          if (arg.type === "Literal" && typeof arg.value === "string") {
            checkStringForColors(arg, arg.value);
          }
          if (arg.type === "TemplateLiteral") {
            for (const quasi of arg.quasis) {
              checkStringForColors(arg, quasi.value.raw);
            }
          }
        }
      },
    };
  },
};
