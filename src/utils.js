export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const randRange = (min, max) => Math.random() * (max - min) + min;
export const removeFromArray = (arr, item) => { const i = arr.indexOf(item); if (i >= 0) arr.splice(i,1); };
