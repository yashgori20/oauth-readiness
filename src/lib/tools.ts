// Real, unauthenticated checks against the provider. They show the endpoints exist and behave
// as documented; they are reported in the probe table, never as evidence for setup steps.

type Probe = { name: string; target: string; ok: boolean; result: string };

// Templated URLs like https://{shop}.myshopify.com can't be probed literally.
export const isTemplated = (url: string) => /[{}<>]|\[[a-z_-]+\]/i.test(url);

// Try discovery on each candidate host; the first that returns JSON wins (Xero's lives on
// identity.xero.com, not the login host the authorize URL uses).
export async function probeOidc(hosts: string[]): Promise<Probe | null> {
  const tried: string[] = [];
  for (const h of [...new Set(hosts.map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "")).filter(Boolean))]) {
    if (isTemplated(h)) continue;
    const url = `https://${h}/.well-known/openid-configuration`;
    tried.push(h);
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) continue;
      const d = await res.json();
      return {
        name: "OIDC discovery",
        target: url,
        ok: true,
        result: `authorize=${d.authorization_endpoint}; scopes=${(d.scopes_supported ?? []).slice(0, 12).join(" ")}`,
      };
    } catch {}
  }
  return tried.length ? { name: "OIDC discovery", target: tried.join(", "), ok: false, result: "no discovery document on these hosts (provider may not support OIDC)" } : null;
}

// Hit the authorize endpoint with a fake client_id. A provider-specific error page
// ("invalid client") proves the endpoint is live and expects registered apps.
export async function probeAuthorize(authorizeUrl: string): Promise<Probe | null> {
  if (isTemplated(authorizeUrl)) return null;
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

// Developer consoles sit behind a login: a redirect to sign-in or a 401/403/406 still means "exists".
export async function probeUrl(url: string): Promise<Probe | null> {
  if (isTemplated(url)) return null;
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8000) });
    const login = /login|signin|sign-in|auth|account/i.test(res.url) && res.url !== url;
    const walled = [401, 403, 406].includes(res.status) || login;
    return {
      name: "Developer console",
      target: url,
      ok: res.ok || walled,
      result: walled ? `reachable, requires sign-in (HTTP ${res.status}, final ${res.url})` : `HTTP ${res.status} (final: ${res.url})`,
    };
  } catch (e) {
    return { name: "Developer console", target: url, ok: false, result: String(e) };
  }
}
