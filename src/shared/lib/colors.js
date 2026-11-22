import { COLORS } from "../../../shared/group-colors.js";

export { COLORS, COLOR_KEYS } from "../../../shared/group-colors.js";

export const colorVars = (key) => {
  const c = COLORS[key] || COLORS.lightblue;
  return { "--h": c.h, "--s": c.s, "--l": c.l };
};
