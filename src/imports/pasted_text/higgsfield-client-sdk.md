Passer au contenu principal
 Join the official Python Developers Survey 2026 and have a chance to win a prize  Take the 2026 survey!
PyPI
Chercher dans PyPI
Type '/' to search projects
Rechercher
Aide Documentation Sponsors Se connecter S'inscrire
higgsfield-client 0.1.0
pip install higgsfield-clientCopier les instructions pip

Dernière version
Dernière version : 18 nov. 2025

Higgsfield API Python SDK

Navigation
 Description du projet
 Historique des versions
 Téléchargement des fichiers
Détails vérifiés 
These details have been verified by PyPI
Maintenu par
Avatar de higgsfield.ai via gravatar.com higgsfield.ai
Détails non vérifiés
Ces détails n'ont pas été vérifiés par PyPi
Liens du projet
Homepage
Repository
Métadonnées
Créé par : Higgsfield
Nécessite : Python >=3.8
Classifieurs
Programming Language
Python :: 3
Python :: 3.8
Python :: 3.9
Python :: 3.10
Python :: 3.11
Python :: 3.12
Python :: 3.13
Python :: 3.14
Signaler le projet comme malware
Description du projet
Higgsfield Python Client
The official Python SDK for Higgsfield AI. Supports both synchronous and asynchronous usage.

Installation
pip install higgsfield-client
Authentication
Before using the client, set your API credentials as environment variables. You can use either a single key or separate API key and secret:

Option 1: Single Key

export HF_KEY="your-api-key:your-api-secret"
Option 2: API Key + Secret

export HF_API_KEY="your-api-key"
export HF_API_SECRET="your-api-secret"
Get your credentials from the Higgsfield Cloud.

Quick Start
Synchronous:

import higgsfield_client

# Submit and wait for result
result = higgsfield_client.subscribe(
    'bytedance/seedream/v4/text-to-image',
    arguments={
        'prompt': 'A serene lake at sunset with mountains',
        'resolution': '2K',
        'aspect_ratio': '16:9',
        'camera_fixed': False
    }
)

print(result['images'][0]['url'])
Asynchronous:

import asyncio

import higgsfield_client

async def main():
    # Submit and wait for result
    result = await higgsfield_client.subscribe_async(
        'bytedance/seedream/v4/text-to-image',
        arguments={
            'prompt': 'A serene lake at sunset with mountains',
            'resolution': '2K',
            'aspect_ratio': '16:9',
            'camera_fixed': False
        }
    )

    print(result['images'][0]['url'])

asyncio.run(main())
Usage Patterns
Pattern 1: Simple Submit and Wait
Submit a request and wait for the result:

Synchronous:

import higgsfield_client

result = higgsfield_client.subscribe(
    'bytedance/seedream/v4/text-to-image',
    arguments={
        'prompt': 'A serene lake at sunset with mountains',
        'resolution': '2K',
        'aspect_ratio': '16:9',
        'camera_fixed': False
    }
)

print(result['images'][0]['url'])
Asynchronous:

import asyncio

import higgsfield_client

async def main():
    result = await higgsfield_client.subscribe_async(
        'bytedance/seedream/v4/text-to-image',
        arguments={
            'prompt': 'A serene lake at sunset with mountains',
            'resolution': '2K',
            'aspect_ratio': '16:9',
            'camera_fixed': False
        }
    )
    
    print(result['images'][0]['url'])

asyncio.run(main())
Pattern 2: Submit and Track Progress
Submit a request and monitor its status in real-time:

Synchronous:

import higgsfield_client

request_controller = higgsfield_client.submit(
    'bytedance/seedream/v4/text-to-image',
    arguments={
        'prompt': 'Football ball',
        'resolution': '2K',
        'aspect_ratio': '16:9',
        'camera_fixed': False
    },
    webhook_url='https://example.com/webhook'  # Optional parameter which calls your webhook on completion
)

for status in request_controller.poll_request_status():
    if isinstance(status, higgsfield_client.Queued):
        print('Queued')
    elif isinstance(status, higgsfield_client.InProgress):
        print('In progress')
    elif isinstance(status, higgsfield_client.Completed):
        print('Completed')
    elif isinstance(status, (higgsfield_client.Failed, higgsfield_client.NSFW, higgsfield_client.Cancelled)):
        print('Oops!')

result = request_controller.get()
print(result['images'][0]['url'])
Asynchronous:

import asyncio

import higgsfield_client

async def main():
    request_controller = await higgsfield_client.submit_async(
        'bytedance/seedream/v4/text-to-image',
        arguments={
            'prompt': 'Football ball',
            'resolution': '2K',
            'aspect_ratio': '16:9',
            'camera_fixed': False
        },
        webhook_url='https://example.com/webhook'  # Optional parameter which calls your webhook on completion
    )

    async for status in request_controller.poll_request_status():
        if isinstance(status, higgsfield_client.Queued):
            print('Queued')
        elif isinstance(status, higgsfield_client.InProgress):
            print('In progress')
        elif isinstance(status, higgsfield_client.Completed):
            print('Completed')
        elif isinstance(status, (higgsfield_client.Failed, higgsfield_client.NSFW, higgsfield_client.Cancelled)):
            print('Oops!')

    result = await request_controller.get()
    print(result['images'][0]['url'])

asyncio.run(main())
Pattern 3: Submit with Callbacks
Use callbacks to handle status updates:

Synchronous:

import higgsfield_client

def on_enqueue(request_id):
    print(f'Request {request_id} was enqueued')

def on_status_update(status):
    print(f'Status: {status}')

result = higgsfield_client.subscribe(
    'bytedance/seedream/v4/text-to-image',
    arguments={
        'prompt': 'A serene lake at sunset with mountains',
        'resolution': '2K',
        'aspect_ratio': '16:9',
        'camera_fixed': False
    },
    on_enqueue=on_enqueue,
    on_queue_update=on_status_update
)
Asynchronous:

import asyncio

import higgsfield_client

def on_enqueue(request_id):
    print(f'Request {request_id} was enqueued')

def on_status_update(status):
    print(f'Status: {status}')

async def main():
    await higgsfield_client.subscribe_async(
        'bytedance/seedream/v4/text-to-image',
        arguments={
            'prompt': 'A serene lake at sunset with mountains',
            'resolution': '2K',
            'aspect_ratio': '16:9',
            'camera_fixed': False
        },
        on_enqueue=on_enqueue,
        on_queue_update=on_status_update
    )

asyncio.run(main())
Pattern 4: Manage Existing Requests
Work with request controller:

Synchronous:

import higgsfield_client

request_controller = higgsfield_client.submit(
    'bytedance/seedream/v4/text-to-image',
    arguments={
        'prompt': 'A serene lake at sunset with mountains',
        'resolution': '2K',
        'aspect_ratio': '16:9',
        'camera_fixed': False
    },
    webhook_url='https://example.com/webhook'  # Optional parameter which calls your webhook on completion
)

# Check status
status = request_controller.status()

# Wait for completion and get result
result = request_controller.get()

# Cancel a queued request
request_controller.cancel()
Or by request ID:

import higgsfield_client

# Check status of any request
status = higgsfield_client.status(request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0')

# Wait for completion and get result
result = higgsfield_client.result(request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0')

# Cancel a queued request
higgsfield_client.cancel(request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0')
Asynchronous:

import asyncio

import higgsfield_client

async def main():
    request_controller = await higgsfield_client.submit_async(
        'bytedance/seedream/v4/text-to-image',
        arguments={
            'prompt': 'A serene lake at sunset with mountains',
            'resolution': '2K',
            'aspect_ratio': '16:9',
            'camera_fixed': False
        },
        webhook_url='https://example.com/webhook'  # Optional parameter which calls your webhook on completion
    )

    # Check status
    status = await request_controller.status()

    # Wait for completion and get result
    result = await request_controller.get()

    # Cancel a queued request
    await request_controller.cancel()

asyncio.run(main())
Or by request ID:

import asyncio

import higgsfield_client

async def main():
    # Check status of any request
    status = await higgsfield_client.status_async(request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0')

    # Wait for completion and get result
    result = await higgsfield_client.result_async(request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0')

    # Cancel a queued request
    await higgsfield_client.cancel_async(request_id='cdbe9381-e617-438f-ac99-b18eb52a05a0')

asyncio.run(main())
File Uploads
Upload files to use in your requests:

Upload bytes
import higgsfield_client

image_path = 'path/to/example.jpeg'
content_type = 'image/jpeg'

with open(image_path, 'rb') as f:
    data = f.read()

url = higgsfield_client.upload(data, content_type)
Upload by path
import higgsfield_client

image_path = 'path/to/example.jpeg'

url = higgsfield_client.upload_file(image_path)
Upload PIL Images
from PIL import Image
import higgsfield_client

image = Image.open('example.jpeg')
url = higgsfield_client.upload_image(image, format='jpeg')
Async Uploads
All upload methods have async versions:

import higgsfield_client

# Async raw data upload
url = await higgsfield_client.upload_async(data, content_type='image/jpeg')

# Async file upload
url = await higgsfield_client.upload_file_async('path/to/example.jpeg')

# Async image upload
url = await higgsfield_client.upload_image_async(image, format='jpeg')

Aide
Installation de paquets
Publier de paquets
Guide d'utilisation
Nom du projet réservé
FAQ
À propos de PyPI
Blog de PyPI
Tableau de bord de l'infrastructure
Statistiques
Logos et marques
Nos sponsors
Contribuer à PyPI
Bugs et commentaires
Contribuer sur GitHub
Traduire PyPI
Soutenir PyPI
Liste des développeurs et développeuses
Utilisation de PyPI
Terms of Service
Signaler un problème de sécurité
Code de conduite
Notice de confidentialité
Politique d'utilisation acceptable
Statut : All Systems Operational

Développé est maintenu par la communauté Python, pour la communauté Python.
Faites un don aujourd'hui !

"PyPI", "Python Package Index", and the Blocks logos are registered Trademarks of the Python Software Foundation .

© 2026 Python Software Foundation
Plan du site

English español français 日本語 português (Brasil) українська Ελληνικά Deutsch 中文 (简体) 中文 (繁體) русский עברית Esperanto 한국어

AWS
Cloud computing and Security Sponsor

Datadog
Monitoring

Depot
Continuous Integration

Fastly
CDN

Google
Download Analytics

Pingdom
Monitoring

Sentry
Error logging

StatusPage
Status page