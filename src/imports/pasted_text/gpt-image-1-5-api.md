Jump to Content
Leonardo.Ai
v1.0
Guides
Recipes
API Reference

Search
⌘K
🏁 QUICK START

Quick Start Guide
Commonly Used Models
📝 GUIDES

Image Generation

FLUX Dev
FLUX Schnell
FLUX.1 Kontext [pro]
FLUX.2 Pro
GPT Image-1.5
Ideogram 3.0
Lucid Origin
Lucid Realism
Nano Banana
Nano Banana Pro
Nano Banana 2
Phoenix
Seedream 4.0
Seedream 4.5
Video Generation

Blueprint Generation

Best Practices

Usage and Cost

Legacy Generation

❓TECHNICAL SUPPORT & QUESTIONS

Frequently Asked Questions

API Error Messages
Special Topics

Need More Support?
MCP SERVER

⚙️
Connect to Leonardo.Ai with the MCP Server
Powered by 

GPT Image-1.5
This guide shows how to generate images using GPT Image-1.5 model via the Leonardo.AI REST API.
This guide shows how to generate images using GPT Image-1.5 model via the Leonardo.AI REST API.

Sample Request

cURL

curl --location 'https://cloud.leonardo.ai/api/rest/v2/generations' \
     --header 'authorization: Bearer {api-key}' \
     --header 'Content-Type: application/json' \
     --data '{
       "public": false,
       "model": "gpt-image-1.5",
       "parameters": {
           "mode": "QUALITY",
           "prompt": "Koala with purple hat",
           "quantity": 2,
           "width": 1024,
           "height": 1024,
           "seed": 4294967295,
           "prompt_enhance": "OFF"
           "guidances": {
               "image_reference": [
                   {
                       "image": {
                       "id": "00000000-0000-0000-0000-000000000001",
                       "type": "UPLOADED"
                       },
                       "strength": "MID",
                   }
               ]
           }
        }
     }'
Recipe

Generate with GPT1.5 Model Using Uploaded Image
Open Recipe
API Request Endpoint, Headers, Parameters

Endpoint

cURL

https://cloud.leonardo.ai/api/rest/v2/generations
Headers

cURL

--header "accept: application/json" \
--header "authorization: Bearer <YOUR_API_KEY>" \
--header "content-type: application/json"
Body Parameters

Parameter	Type	Definition
guidances	object	Optional. Object defining image guidance inputs that influence the generated result.
guidances.image_reference	array	Optional. Array of up to 6 reference images. Each reference includes image.id, image.type (GENERATED or UPLOADED), and strength (LOW, MID, HIGH).
height	integer	Optional. Height input resolution.
mode	string	Optional. Accepts FAST, QUALITY, or ULTRA.
model	string	Required. Model identifier. Set to gpt-image-1.5
prompt	string	Required. Text prompt describing what image you want the model to generate.
prompt_enhance	string	Optional. Enables prompt enhancement when set to "ON"; disabled when set to "OFF".
public	boolean	Optional. Boolean flag that determines whether the generation is public (true) or private (false).
quantity	integer	Optional. Number of images to generate in a single request.
seed	integer	Optional. Apply a fixed seed to maintain consistency across generation sets.
width	integer	Optional. Width input resolution.
Aspect Ratio Settings

Aspect Ratio	Width	Height
2:3	1024	1536
1:1	1024	1024
3:2	1536	1024
Updated about 2 months ago

FLUX.2 Pro
Ideogram 3.0
Did this page help you?
TABLE OF CONTENTS
Sample Request
Recipe
API Request Endpoint, Headers, Parameters
Endpoint
Headers
Body Parameters
