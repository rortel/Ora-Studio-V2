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

FLUX.1 Kontext [pro]
This guide shows how to generate images using FLUX.1 Kontext [pro] model via the Leonardo.AI REST API.
This guide shows how to generate images using FLUX.1 Kontext [pro] model via the Leonardo.AI REST API.

Sample Request

cURL

curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <YOUR_API_KEY>' \
     --header 'content-type: application/json' \
     --data '{
       "prompt": "a kangaroo wearing a scarf",
       "modelId": "28aeddf8-bd19-4803-80fc-79602d1a9989",
       "styleUUID": "111dc692-d470-4eec-b791-3475abac4c46",
       "num_images": 1,
       "width": 832,
       "height": 1248,
       "contextImages": [{
           "type": "UPLOADED",
           "id": "0edab5a7-2efe-49b4-9283-7c79dd642981"
       }]
     }'
Recipe

Generate with Flux.1-Kontext [pro] Model Using Multi Uploaded Images
Open Recipe
Generate with Flux.1-Kontext [pro] Model Using Uploaded Image
Open Recipe
API Request Endpoint, Headers, Parameters

Endpoint

cURL

https://cloud.leonardo.ai/api/rest/v1/generations
Headers

cURL

--header "accept: application/json" \
--header "authorization: Bearer <YOUR_API_KEY>" \
--header "content-type: application/json"
Body Parameters

Parameter	Type	Definition
contrast	number	Required. Controls the contrast/detail level of generated images. Valid values: [3, 3.5, 4] where 3 corresponds to Low, 3.5 corresponds to Medium, and 4 corresponds to High in the web UI.
contextImages	array	Optional. Array of up to 4 context images. Each context includes id (the image ID) and type (GENERATED or UPLOADED).
enhancePrompt	string	Optional. Enables prompt enhancement. Set to true for enhanced prompt behavior; when paired with enhancePromptInstruction it refines the prompt further.
enhancePromptInstruction	string	Optional. Provides additional instruction used alongside enhancePrompt=true.
height	integer	Optional. Height input resolution.
modelId	string	Required. UUID of the model to use. Set to 28aeddf8-bd19-4803-80fc-79602d1a9989.
num_images	integer	Optional. Number of images to generate in the batch.
prompt	string	Required. Text prompt describing what image you want the model to generate.
seed	integer	Optional. Apply a fixed seed to maintain consistency across generation sets. The maximum seed number is 2147483638.
styleUUID	string	Optional. UUID of a preset style that affects the aesthetic output. Refer to the table below for a list of UUIDs.
ultra	boolean	Optional. When true, enables Ultra generation mode.
width	integer	Optional. Width input resolution.

Updated about 2 months ago

FLUX Schnell
FLUX.2 Pro
Did this page help you?
TABLE OF CONTENTS
Sample Request
Recipe
API Request Endpoint, Headers, Parameters
Endpoint
