Step 1 -- Server Health
Verify the Edge Function responds
Ping
Server OK
(683ms)
[anon-key] {"status":"ok","server":"ora-studio","aiLoaded":true,"aiError":null,"ts":"2026-03-06T08:19:57.669Z"}
Step 2 -- API Keys
Check which keys are configured on the server
Load Config
APIPOD
sk-692...a6b3 (67 chars)
FAL
438a18...cf27 (69 chars)
REPLICATE
r8_Z9F...xiFI (40 chars)
Step 3 -- Provider Tests (individual)
Test each provider separately to avoid timeouts. Click each button.
APIPod Text
Chat completions (GPT-4o)
OK
1949ms
HTTP 200
Test
{"id":"chatcmpl-DGKhqtnMrGeN9nslwKHTwu5fXQK6m","object":"chat.completion","created":1772785214,"model":"gpt-4o","choices":[{"index":0,"message":{"content":"Hello there! How can I assist you today?","role":"assistant"},"finish_reason":"length"}],"usage":{"prompt_tokens":9,"completion_tokens":10,"total_tokens":19,"reasoning_tokens":0}}
APIPod Image
Image generations (DALL-E 3)
FAIL
566ms
HTTP 500
Test
{"error":{"message":"model not found: model not found","type":"internal_error","code":"internal_error"}}
FAL AI
Image (Flux Schnell)
OK
688ms
HTTP 200
Test
{"images":[{"url":"https://v3b.fal.media/files/b/0a910e3a/3YFJvSRPE2hWwDoPU7PmX.jpg","width":512,"height":512,"content_type":"image/jpeg"}],"timings":{"inference":0.07297437499801163},"seed":2114040810,"has_nsfw_concepts":[false],"prompt":"A blue circle"}
Replicate
Account auth check
OK
314ms
HTTP 200
Test
{"type":"user","username":"rortel","name":"","avatar_url":"https://github.com/rortel.png","github_url":"https://github.com/rortel"}
Run All (sequential requests)
Step 4 -- End-to-End Generation
Test the full pipeline (ai.tsx fallback chain) with prompt "A simple blue circle"
Text (GPT-4o)
Text (Claude)
Image (ORA Vision)
Image (DALL-E)
Image (Flux Pro)