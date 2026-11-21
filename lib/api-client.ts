// Small fetch wrapper for the JSON API routes. Never throws; failures come back as `error`.
export async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>): Promise<{ error?: string; id?: string }> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json().catch(() => ({})) as { error?: string; id?: string };
    if (!response.ok) return { error: result.error ?? "Unable to save. Please try again." };
    return result;
  } catch {
    return { error: "Could not connect. Please try again." };
  }
}
