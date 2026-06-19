# 3percentclub Agentic Workshop: Starter Repo

Welcome to the 3percentclub Agentic Workshop! This repository contains the starter files you need to interact with NVIDIA's NIM APIs using raw Python.

## Prerequisites
Before starting, ensure you have completed the pre-work:
1. Created an [NVIDIA Developer Account](https://build.nvidia.com/) and generated an API key.
2. Created a [Brev.dev](https://brev.dev/) account and installed the Brev CLI.

## Getting Started

**1. Launch your environment**
Using the Brev CLI, spin up your GPU environment synced to this repository:
```bash
brev launch https://github.com/mashby2022/agents-of-change
```

## Building a Frontend with Lovable

During this workshop, we will be using [Lovable.dev](https://lovable.dev) to build a beautiful UI for our AI agents. Lovable will create the frontend, and your Brev environment will act as the backend.

### Setting up your Lovable Account & Credits

You have been provided with credits to use Lovable's Pro Plan. Follow these steps to apply them:

1. Go to [lovable.dev](https://lovable.dev).
2. If you don't have an account, click on **"Get started"** → Create an account.
3. If you already have an account (or after creating one), go to **Settings → Plans & Credits**.
4. Select **Pro Plan 1 (100 credits)**. *Note: Make sure to choose the monthly plan.*
5. At checkout, enter your discount code: `COMM-AGENTS-PJK7`

### Connecting Lovable to your Python Agent

**1. Start your Backend API** Run the included FastAPI server to expose your Python agent to the web:

```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000

**2. Get your Brev endpoint URL**
Your Brev instance has a public URL mapping to port 8000. You can find this in your Brev console or via the Brev CLI. It will look something like `https://8000-xxxx.brev.dev`.

**3. Prompt Lovable**
Go to Lovable and use a prompt like this to generate your chat interface:

> "Create a modern chat interface. When I submit a message, send a POST request to `https://[YOUR_BREV_URL]/chat` with the JSON payload `{"message": "user text"}`. Display the `reply` field from the response."