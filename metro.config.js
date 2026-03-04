const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

let config = getDefaultConfig(__dirname);
config = withRorkMetro(config);

// zod/v4 サブパス解決（RN/Metro が package exports を正しく解決しない場合の対策）
const originalResolveRequest = config.resolver?.resolveRequest;
config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "zod/v4" || moduleName.startsWith("zod/v4/")) {
    try {
      const zodRoot = path.dirname(require.resolve("zod/package.json"));
      const subpath = moduleName === "zod/v4" ? "index" : moduleName.replace("zod/v4/", "").replace(/\/$/, "") || "index";
      const fs = require("fs");
      const v4Dir = path.join(zodRoot, "v4");
      const candidates = [
        path.join(v4Dir, subpath + ".js"),
        path.join(v4Dir, subpath, "index.js"),
        path.join(v4Dir, "index.js"),
      ];
      for (const fp of candidates) {
        if (fs.existsSync(fp)) return { type: "sourceFile", filePath: fp };
      }
    } catch (_e) {
      /* fall through to default */
    }
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
