export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow all comments. Code, names, types, and tests carry the meaning instead.",
    },
    schema: [],
    messages: {
      noComments:
        "No comments in code. Make the code say it: rename, extract, encode it in a type, or cover it with a test.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          context.report({ loc: comment.loc, messageId: "noComments" });
        }
      },
    };
  },
};
