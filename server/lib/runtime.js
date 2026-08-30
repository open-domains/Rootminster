export const secrets = {
  get(name) {
    return process.env[name];
  },
};
