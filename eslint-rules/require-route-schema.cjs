// @ts-nocheck
const fs = require("fs");
const path = require("path");

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require a .schema.ts file alongside every route file in server/api/routers/",
      category: "Best Practices",
    },
    messages: {
      missingSchemaFile:
        "Route files must have a sibling .schema.ts file (e.g., {{routeName}}.schema.ts) defining Zod input/output schemas.",
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const basename = path.basename(filename);

    // Skip index.ts and files that are already schema files
    if (basename === "index.ts" || basename.endsWith(".schema.ts")) {
      return {};
    }

    return {
      Program(node) {
        const dir = path.dirname(filename);
        const routeName = basename.replace(/\.ts$/, "");
        const schemaFile = path.join(dir, `${routeName}.schema.ts`);

        if (!fs.existsSync(schemaFile)) {
          context.report({
            node,
            messageId: "missingSchemaFile",
            data: { routeName },
          });
        }
      },
    };
  },
};
