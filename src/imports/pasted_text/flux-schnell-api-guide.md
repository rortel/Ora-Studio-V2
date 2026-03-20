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

FLUX Schnell
This guide shows how to generate images using FLUX Schnell model via the Leonardo.AI REST API.
This guide shows how to generate images using FLUX Schnell model via the Leonardo.AI REST API.

Sample Request

cURL

curl --request POST \
     --url https://cloud.leonardo.ai/api/rest/v1/generations \
     --header 'accept: application/json' \
     --header 'authorization: Bearer <YOUR_API_KEY>' \
     --header 'content-type: application/json' \
     --data '{
       "modelId": "1dd50843-d653-4516-a8e3-f0238ee453ff",
       "contrast": 3.5,
       "prompt": "a photo of an orange cat playing with a tennis ball with the text FLUX",
       "num_images": 4,
       "width": 1024,
       "height": 1024,
       "styleUUID": "111dc692-d470-4eec-b791-3475abac4c46",
       "enhancePrompt": false
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
contrast	number	Required. Controls the contrast/detail level of generated images. Valid values: [3, 3.5, 4] where 3 corresponds to Low, 3.5 corresponds to Medium, and 4 corresponds to High in the web UI.
enhancePrompt	string	Optional. Enables prompt enhancement. Set to true for enhanced prompt behavior; when paired with enhancePromptInstruction it refines the prompt further.
enhancePromptInstruction	string	Optional. Provides additional instruction used alongside enhancePrompt=true.
height	integer	Optional. Height input resolution.
modelId	string	Required. UUID of the model to use. Set to 1dd50843-d653-4516-a8e3-f0238ee453ff.
num_images	integer	Optional. Number of images to generate in the batch.
prompt	string	Required. Text prompt describing what image you want the model to generate.
seed	integer	Optional. Apply a fixed seed to maintain consistency across generation sets. The maximum seed number is 2147483638.
styleUUID	string	Optional. UUID of a preset style that affects the aesthetic output. Refer to the table below for a list of UUIDs.
ultra	boolean	Optional. When true, enables Ultra generation mode.
width	integer	Optional. Width input resolution.
List of Style UUIDs

Preset Style	UUID
3D Render	debdf72a-91a4-467b-bf61-cc02bdeb69c6
Acrylic	3cbb655a-7ca4-463f-b697-8a03ad67327c
Anime General	b2a54a51-230b-4d4f-ad4e-8409bf58645f
Creative	6fedbf1f-4a17-45ec-84fb-92fe524a29ef
Dynamic	111dc692-d470-4eec-b791-3475abac4c46
Fashion	594c4a08-a522-4e0e-b7ff-e4dac4b6b622
Game Concept	09d2b5b5-d7c5-4c02-905d-9f84051640f4
Graphic Design 3D	7d7c2bc5-4b12-4ac3-81a9-630057e9e89f
Illustration	645e4195-f63d-4715-a3f2-3fb1e6eb8c70
None	556c1ee5-ec38-42e8-955a-1e82dad0ffa1
Portrait	8e2bc543-6ee2-45f9-bcd9-594b6ce84dcd
Portrait Cinematic	4edb03c9-8a26-4041-9d01-f85b5d4abd71
Ray Traced	b504f83c-3326-4947-82e1-7fe9e839ec0f
Stock Photo	5bdc3f2a-1be6-4d1c-8e77-992a30824a2c
Watercolor	1db308ce-c7ad-4d10-96fd-592fa6b75cc4
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
       "modelId": "1dd50843-d653-4516-a8e3-f0238ee453ff",
       "prompt": "Intricately swirling nebulas dance across a vividly colored galactic map",
       "width": 1024,
       "controlnets": [
             {
                 "initImageId": "06c4d15c-0d32-42b3-bec2-4e1d685d229f",
                 "initImageType": "GENERATED",
                 "preprocessorId": 232, // Content Reference
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
Flux Schnell	298	n/a	232
Uploading Images

Upload an Image and Print the Image ID
Open Recipe
Updated about 2 months ago

FLUX Dev
FLUX.1 Kontext [pro]
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
