export async function installationId() {
  let id = sessionStorage.getItem("freight-web-installation");
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("freight-web-installation", id); }
  return id;
}
export async function registerPush() { return () => {}; }
export async function invalidatePush() {}
