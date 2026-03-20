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

Ideogram 3.0
This guide shows how to generate images using Ideogram 3.0 model via the Leonardo.AI REST API.
This guide shows how to generate images using Ideogram 3.0 model via the Leonardo.AI REST API.

Sample Request

cURL

curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v2/generations \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <YOUR_API_KEY>' \
     --header 'content-type: application/json' \
     --data '{
       "model": "ideogram-v3.0",
       "parameters": {
           "width": 1024,
           "height": 1024,
           "prompt": "A dynamically stylish green running shoe dominates the frame, with the text Leonardo, the text boldly emblazoned in white. Against a vivid blue backdrop, the shoe exudes modernity with a hint of motion blur, conveying speed and dynamism. Crisp lines and vibrant hues are subtly softened, capturing the essence of movement",
           "mode": "TURBO",
           "quantity": 2,
           "style_ids": [
               "111dc692-d470-4eec-b791-3475abac4c46"
           ]
       },
       "public": false
   }'
Recipe

Generate Images Using Ideogram 3.0
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
height	integer	Optional. Height input resolution.
mode	string	Optional. Accepts TURBO, BALANCED, or QUALITY.
model	string	Required. Model identifier. Set to ideogram-v3.0
prompt	string	Required. Text prompt describing what image you want the model to generate.
prompt_enhance	string	Optional. Enables prompt enhancement when set to "ON"; disabled when set to "OFF".
public	boolean	Optional. Boolean flag that determines whether the generation is public (true) or private (false).
quantity	integer	Optional. Number of images to generate in a single request.
seed	integer	Optional. Apply a fixed seed to maintain consistency across generation sets.
style_ids	array	Optional. Array of style UUIDs used to apply preset artistic styles to the output.
width	integer	Optional. Width input resolution.
List of Style IDs

Preset Style	UUID
Cinematic	a5632c7c-ddbb-4e2f-ba34-8456ab3ac436
Creative	6fedbf1f-4a17-45ec-84fb-92fe524a29ef
Dynamic	111dc692-d470-4eec-b791-3475abac4c46
Fashion	594c4a08-a522-4e0e-b7ff-e4dac4b6b622
Portrait	ab5a4220-7c42-41e5-a578-eddb9fed3d75
Stock Photo	5bdc3f2a-1be6-4d1c-8e77-992a30824a2c
Vibrant	dee282d3-891f-4f73-ba02-7f8131e5541b
Updated about 2 months ago

GPT Image-1.5
Lucid Origin
Did this page help you?
TABLE OF CONTENTS
Sample Request
Recipe
API Request Endpoint, Headers, Parameters
Endpoint
Headers
Body Parameters
List of Style IDs
