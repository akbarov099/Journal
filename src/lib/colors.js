// Цвета групп. h/s/l — оттенок, насыщенность (0..1) и яркость.
// Все цвета подобраны так, чтобы белый текст на них читался (контраст ~4:1 и выше).
export const COLORS = {
  gold: { name: "Gold", h: 44, s: 1, l: 32 },
  crimson: { name: "Crimson", h: 348, s: 1, l: 45 },
  lightblue: { name: "Light blue", h: 199, s: 1, l: 37 },
  silver: { name: "Silver", h: 215, s: 0.07, l: 47 },
  emerald: { name: "Emerald", h: 152, s: 1, l: 28 },
  violet: { name: "Violet", h: 268, s: 1, l: 52 },
};
export const COLOR_KEYS = Object.keys(COLORS);

export const colorVars = (key) => {
  const c = COLORS[key] || COLORS.lightblue;
  return { "--h": c.h, "--s": c.s, "--l": c.l };
};
