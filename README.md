# Renovation Scope Drafter – Prototype

FYP midterm prototype. Multimodal AI pipeline that takes a site photo + voice note and outputs a renovation scope of work. Still very much a work in progress.

## What it does

Upload an image and audio recording of a renovation site. The backend sends them through a vision model and a speech-to-text model, then a language model stitches it all together into a scope of work with line items and costs.

The frontend then lets you review and edit everything before exporting.

## Stack

- **Frontend** – Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui
- **Backend** – FastAPI + Uvicorn, Python 3.11

## Running locally

Open two terminals.
Ensure that you have Ollama installed. The models being used are: `llava:1.5` (vision), `llama3:instruct` (text), and `distil-whisper-medium.en` (audio).`

**Terminal 1 – backend**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```
Runs on http://localhost:8000

**Terminal 2 – frontend**
```bash
cd frontend
npm run dev
```
Runs on http://localhost:3000

## Current State & Functionality

The application is a fully functional, edge-deployed renovation scope generator. Key features and workflows include:

### User Interface & Experience
* **Room-Based Organisation**: Users can create distinct 'Rooms' and upload associated site photographs (including HEIC formats) and voice recordings.

* **Add More Context**: An interactive review panel allows users to seamlessly append extra photos or voice notes to a room at any time without overwriting existing data.

* **Human-in-the-Loop Editing**: Users can manually verify and edit the generated scope of work items (description, quantity, cost) before finalisation.

* **PDF Export**: Real-time PDF preview and generation of the final itemised contract/scope of work.

### Backend Architecture & Memory Management
* **Real-time SSE Streaming**: The frontend communicates with the FastAPI backend via Server-Sent Events (SSE), displaying dynamic loading stages (e.g., "Analysing site photograph [28s]...") to completely prevent UI timeouts.

* **Strict VRAM Offloading**: Models are loaded into Apple Silicon MPS sequentially and forcefully purged from memory (`del`, `gc.collect()`, `torch.mps.empty_cache()`) before the next model runs. This ensures the application operates strictly within edge hardware memory limits without causing kernel panics or disk swapping.

* **Fallback Handling**: Graceful error handling ensures partial pipeline failures (e.g. corrupt audio) return available data rather than crashing the server.

### How the Multi-Modal Models Work Together
The backend relies on a strictly ordered pipeline to achieve maximum contextual accuracy:
1. **Audio Transcription (`distil-whisper-medium.en`)**: The user's audio recordings are chunked and transcribed into text using Hugging Face `transformers`.

2. **Context-Aware Vision Analysis (`llava:1.5`)**: The vision model does not analyze the photograph blindly. It is first fed the audio transcription, allowing it to specifically seek out and identify the damage or features the user verbally mentioned (e.g., looking for a specific PVC pipe leak instead of hallucinating general wall damage).

3. **Structured Text Synthesis (`llama3:instruct`)**: Finally, the highly accurate transcription and context-aware vision analysis are combined and fed to the text model, which structures the raw data into precise, professional, line-itemised renovation scopes, producing a mathematical correct quotation.

## Folder structure

```
PROTOTYPE/
  backend/
    main.py           # FastAPI app
    requirements.txt
    venv/             # Python 3.11 virtual env
  frontend/
    app/
      page.tsx        # main page, all three phases
      layout.tsx
      globals.css
    components/
      ui/             # shadcn components
    lib/
      utils.ts
```


## To test backend models are working (skeleton structure)

```bash
cd backend
source venv/bin/activate
python test_pipeline.py
```