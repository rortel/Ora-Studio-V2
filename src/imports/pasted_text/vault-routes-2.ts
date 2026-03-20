// VAULT ROUTES — Clean Restart  
// ══════════════════════════════════════════════════════════════

app.get("/vault", async (c) => {
  try {
    const user = await requireAuth(c);
    const vault = await kv.get(`vault:${user.id}`);
    return c.json({ success: true, vault: vault || null });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.put("/vault", async (c) => {
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const existing = (await kv.get(`vault:${user.id}`)) || {};
    const updated = { ...existing, ...body, userId: user.id, updatedAt: new Date().toISOString() };
    await kv.set(`vault:${user.id}`, updated);
    return c.json({ success: true, vault: updated });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.post("/vault/scan-url", async (c) => {
  const t0 = Date.now();
  console.log("[vault/scan-url] ✅ Request received");
  
  try {
    const user = await requireAuth(c);
    const body = await c.req.json();
    const rawUrl = body.url;
    
    if (!rawUrl) return c.json({ success: false, error: "URL required" }, 400);
    
    const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    console.log("[vault/scan-url] Scanning:", url);
    
    // JINA SCRAPE
    const jinaKey = Deno.env.get("JINA_API_KEY");
    if (!jinaKey) return c.json({ success: false, error: "JINA_API_KEY not set" }, 500);
    
    const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Authorization: `Bearer ${jinaKey}`, Accept: "text/plain" },
      signal: AbortSignal.timeout(15000),
    });
    
    if (!jinaRes.ok) {
      return c.json({ success: false, error: `Scrape failed: ${jinaRes.status}` }, 500);
    }
    
    const markdown = await jinaRes.text();
    console.log("[vault/scan-url] Scraped", markdown.length, "chars");
    
    if (!markdown || markdown.length < 50) {
      return c.json({ success: false, error: "Content too short" }, 422);
    }
    
    // MISTRAL ANALYSIS
    const mistralKey = Deno.env.get("MISTRAL_API_KEY");
    if (!mistralKey) return c.json({ success: false, error: "MISTRAL_API_KEY not set" }, 500);
    
    const systemPrompt = `You are an expert brand analyst. Analyze the website and return ONLY valid JSON:
{"brandName":"string","industry":"string","tone":{"formality":7,"confidence":8,"warmth":5,"humor":3},"keyMessages":["msg1","msg2"],"vocabulary":{"approvedTerms":["word1"],"forbiddenTerms":["word1"]},"audiences":{"primary":"desc"},"colors":["#FF0000"],"typography":["Font1"]}`;
    
    const mistralRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${mistralKey}` },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Analyze: ${url}\n\n${markdown.slice(0, 8000)}` },
        ],
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30000),
    });
    
    if (!mistralRes.ok) {
      return c.json({ success: false, error: `AI failed: ${mistralRes.status}` }, 500);
    }
    
    const aiData = await mistralRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    
    if (!rawContent) return c.json({ success: false, error: "Empty AI response" }, 500);
    
    const scan = JSON.parse(rawContent.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim());
    scan.sourceUrl = url;
    scan.scannedAt = new Date().toISOString();
    
    console.log(`[vault/scan-url] ✅ Done in ${Date.now() - t0}ms — ${scan.brandName}`);
    return c.json({ success: true, scan });
    
  } catch (err: any) {
    console.error("[vault/scan-url] Error:", err);
    return c.json({ success: false, error: String(err.message || err) }, 500);
  }
});