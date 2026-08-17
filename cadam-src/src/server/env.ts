export function env(name: string): string {
  return process.env[name] ?? '';
}

export function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function webhookBaseUrl(requestUrl: string): string {
  const configuredUrl = env('WEBHOOK_BASE_URL');
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');
  return new URL(requestUrl).origin;
}
