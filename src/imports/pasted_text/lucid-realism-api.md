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

Lucid Realism
This guide shows how to generate images using Lucid Realism models via the Leonardo.AI REST API.
This guide shows how to generate images using Lucid Realism model via the Leonardo.AI REST API.

Note: Lucid Origin and Lucid Realism are available through the MCP Server (Multi-Cloud Proxy) workflow as well — see Connect to Leonardo.AI with the MCP Server.

Sample Request

cURL

curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <YOUR_API_KEY>' \
     --header 'content-type: application/json' \
     --data '{
       "alchemy": false,
       "height": 1024,
       "modelId": "05ce0082-2d80-4a2d-8653-4d1c85e2418e",
       "contrast": 3.5,
       "num_images": 4,
       "styleUUID": "111dc692-d470-4eec-b791-3475abac4c46",
       "prompt": "a white cat holding a red balloon on a carousel",
       "width": 1024,
       "ultra": false
     }'
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
alchemy	boolean	Optional. When true, enables Quality generation mode for Leonardo Phoenix. This parameter is not supported for Lucid Origin and Lucid Realism.
contrast	number	Required. Controls the contrast/detail level of generated images. Valid values: [3, 3.5, 4] where 3 corresponds to Low, 3.5 corresponds to Medium, and 4 corresponds to High in the web UI.
enhancePrompt	string	Optional. Enables prompt enhancement. Set to true for enhanced prompt behavior; when paired with enhancePromptInstruction it refines the prompt further.
enhancePromptInstruction	string	Optional. Provides additional instruction used alongside enhancePrompt=true.
height	integer	Optional. Height input resolution.
modelId	string	Required. UUID of the model to use. Set to 05ce0082-2d80-4a2d-8653-4d1c85e2418e.
num_images	integer	Optional. Number of images to generate in the batch.
prompt	string	Required. Text prompt describing what image you want the model to generate.
seed	integer	Optional. Apply a fixed seed to maintain consistency across generation sets.
styleUUID	string	Optional. UUID of a preset style that affects the aesthetic output. Refer to the table below for a list of UUIDs.
ultra	boolean	Optional. When true, enables Ultra generation mode.
width	integer	Optional. Width input resolution.
List of Style UUIDs

Preset Style	UUID
Bokeh	9fdc5e8c-4d13-49b4-9ce6-5a74cbb19177
Cinematic	a5632c7c-ddbb-4e2f-ba34-8456ab3ac436
Cinematic Close-Up	cc53f935-884c-40a0-b7eb-1f5c42821fb5
Creative	6fedbf1f-4a17-45ec-84fb-92fe524a29ef
Dynamic	111dc692-d470-4eec-b791-3475abac4c46
Fashion	594c4a08-a522-4e0e-b7ff-e4dac4b6b622
Film	85da2dcc-c373-464c-9a7a-5624359be859
Food	d574325d-1278-4fe2-974b-768525f253c3
HDR	97c20e5c-1af6-4d42-b227-54d03d8f0727
Long Exposure	335e6010-a75c-45d9-afc5-032c65e9180e
Macro	30c1d34f-e3a9-479a-b56f-c018bbc9c02a
Minimalist	cadc8cd6-7838-4c99-b645-df76be8ba8d8
Monochrome	a2f7ea66-959b-4bbe-b508-6133238b76b6
Moody	621e1c9a-6319-4bee-a12d-ae40659162fa
Neutral	0d914779-c822-430a-b976-30075033f1c4
None	556c1ee5-ec38-42e8-955a-1e82dad0ffa1
Portrait	8e2bc543-6ee2-45f9-bcd9-594b6ce84dcd
Retro	6105baa2-851b-446e-9db5-08a671a8c42f
Stock Photo	5bdc3f2a-1be6-4d1c-8e77-992a30824a2c
Unprocessed	62736842-6e4b-4028-b79a-4f1a1606e893
Vibrant	dee282d3-891f-4f73-ba02-7f8131e5541b
Image Guidance

Sample Request

cURL

curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <YOUR_API_KEY>' \
     --header 'content-type: application/json' \
     --data '{
       "height": 1024,
       "modelId": "05ce0082-2d80-4a2d-8653-4d1c85e2418e", // Lucid Realism
       "prompt": "Intricately swirling nebulas dance across a vividly colored galactic map",
       "width": 1024,
       "controlnets": [
             {
                 "initImageId": "06c4d15c-0d32-42b3-bec2-4e1d685d229f",
                 "initImageType": "GENERATED",
                 "preprocessorId": 430, // Content Reference
                 "strengthType": "High"
             }   
         ]
     }'
Body Parameters

Parameter	Type	Definition
initImageId	string	Leonardo Image ID.
initImageType	string	Whether an image is generated on or uploaded to the Leonardo platform. Accepts GENERATED or UPLOADED. To upload an image, see the recipe below.
preprocessorId	integer	ID corresponding to the type of image guidance. Refer to the table below for a list of preprocessor IDs.
strengthType	string	Strength of the input image guidance. Accepts Low, Mid, or High.
List of Preprocessor IDs

Model	Style Reference	Character Reference	Content Reference
Lucid Realism	431	n/a	430
Uploading Images

Upload an Image and Print the Image ID
Open Recipe

Updated about 2 months ago

Lucid Origin
Nano Banana
Did this page help you?
TABLE OF CONTENTS
Sample Request
API Request Endpoint, Headers, Parameters
Endpoint
Headers
Body Parameters
List of Style UUIDs
Image Guidance
Sample Request
Body Parameters
Uploading Images
