// Real, unauthenticated checks against the provider. These produce `tested` evidence.
export async function probeOidc(domain: string) {
  const url = `https://${domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}/.well-known/openid-configuration`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { name: "OIDC discovery", target: url, ok: false, result: `HTTP ${res.status}` };
    const d = await res.json();
    return {
      name: "OIDC discovery",
      target: url,
      ok: true,
      result: `authorize=${d.authorization_endpoint}; scopes=${(d.scopes_supported ?? []).slice(0, 12).join(" ")}`,
    };
  } catch (e) {
    return { name: "OIDC discovery", target: url, ok: false, result: String(e) };
  }
}

// Hit the authorize endpoint with a fake client_id. A provider-specific error page
// ("invalid client") proves the endpoint is live and expects registered apps.
export async function probeAuthorize(authorizeUrl: string) {
  const u = new URL(authorizeUrl);
  u.searchParams.set("client_id", "probe-not-a-real-client");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", "https://example.com/callback");
  try {
    const res = await fetch(u, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    const loc = res.headers.get("location") ?? "";
    const body = res.status < 300 ? (await res.text()).slice(0, 2000) : "";
    const hint = /invalid[_ ]client|client.?id|unknown client|not found/i.exec(loc + body)?.[0];
    return {
      name: "Authorize endpoint",
      target: u.origin + u.pathname,
      ok: res.status < 500,
      result: `HTTP ${res.status}${loc ? ` -> ${loc.slice(0, 120)}` : ""}${hint ? ` (mentions "${hint}")` : ""}`,
    };
  } catch (e) {
    return { name: "Authorize endpoint", target: authorizeUrl, ok: false, result: String(e) };
  }
}

export async function probeUrl(url: string) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    return { name: "URL reachable", target: url, ok: res.ok, result: `HTTP ${res.status} (final: ${res.url})` };
  } catch (e) {
    return { name: "URL reachable", target: url, ok: false, result: String(e) };
  }
}
