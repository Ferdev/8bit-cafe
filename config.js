// Public browser configuration. The production container replaces this file
// from runtime environment variables. Browser credentials are visible to users,
// so use only a restricted TypeSafe key with an explicit spending limit.
window.CHIPCAFE_CONFIG = Object.freeze({
  typesafeApiKey: "",
  typesafeModel: "jev-latest",
});
