/**
 * Basit Reverse Proxy - Cloudflare Workers
 * ------------------------------------------------
 * Bu script, bir Cloudflare Worker'a deploy edilir ve
 * istekleri belirlenen hedef siteye (instagram.com, youtube.com,
 * tiktok.com gibi) yönlendirir. Trafik Cloudflare'in IP aralığı
 * üzerinden gittiği için, hedef domaine doğrudan DNS/IP engeli
 * koyan ağlarda genellikle erişilebilir olur.
 *
 * ÖNEMLİ SINIRLAMALAR:
 * - Bazı platformlar (Instagram, TikTok) güçlü bot/otomasyon
 *   koruması kullanır; login, aramalar, video oynatma gibi
 *   dinamik işlevler bu basit proxy ile tam çalışmayabilir.
 * - Bu script hiçbir kullanıcı adı/şifre toplamaz, sadece
 *   trafiği olduğu gibi iletir (pass-through).
 * - Telif/ToS: Hedef platformların kullanım şartlarına uymak
 *   senin sorumluluğundadır.
 *
 * KURULUM:
 * 1. https://dash.cloudflare.com -> ücretsiz hesap aç
 * 2. Workers & Pages -> Create Worker
 * 3. Aşağıdaki kodu yapıştır, Deploy'a bas
 * 4. Worker'a verilen URL'yi (ör: https://seninworkerin.workers.dev)
 *    index.html dosyasındaki TARGETS kısmına ekle
 */

// Proxy edilecek hedefler: path prefix -> gerçek hedef domain
const TARGETS = {
  "/insta": "https://www.instagram.com",
  "/youtube": "https://www.youtube.com",
  "/tiktok": "https://www.tiktok.com",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Hangi hedefe gidileceğini path'ten bul
    const matched = Object.keys(TARGETS).find((prefix) =>
      url.pathname.startsWith(prefix)
    );

    if (!matched) {
      return new Response(
        "Kullanım: /insta/... , /youtube/... , /tiktok/...",
        { status: 200 }
      );
    }

    const targetBase = TARGETS[matched];
    const targetPath = url.pathname.slice(matched.length) || "/";
    const targetUrl = targetBase + targetPath + url.search;

    // Orijinal isteği hedefe ilet
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.method !== "GET" && request.method !== "HEAD"
        ? request.body
        : undefined,
      redirect: "follow",
    });

    // User-Agent'ı gerçekçi tut (bazı siteler botları engeller)
    proxyRequest.headers.set(
      "User-Agent",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );

    const response = await fetch(proxyRequest);

    // Yanıtı kopyala, iframe içinde açılabilmesi için
    // güvenlik başlıklarını gevşet
    const newHeaders = new Headers(response.headers);
    newHeaders.delete("content-security-policy");
    newHeaders.delete("x-frame-options");
    newHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};