const developmentBuild = typeof import.meta.env !== 'undefined' && import.meta.env.DEV;
let active = false;

export const devPreviewAuth = {
  get available() {
    return developmentBuild;
  },
  isActive() {
    return developmentBuild && active;
  },
  enter() {
    if (!developmentBuild) return false;
    active = true;
    return true;
  },
  leave() {
    active = false;
  },
};
