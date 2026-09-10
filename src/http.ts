export async function isAvailable(url: string, timeoutMs: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "Utel-Hreflang-Validator/1.0", accept: "text/html" }
    });
    return response.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

