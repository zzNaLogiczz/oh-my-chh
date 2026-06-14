import type { ThemeModule } from "../../../theme-module";

export const flatCleanTheme: ThemeModule = {
  id: "flat-clean",
  enhance(ctx, scope) {
    const root = ctx.root instanceof Document ? ctx.root.documentElement : document.documentElement;
    scope.setAttr(root, "data-omchh-flat-clean-ready", "1");
  }
};
