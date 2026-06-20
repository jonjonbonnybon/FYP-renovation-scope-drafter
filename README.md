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

**Terminal 1 – backend**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```
Runs on http://localhost:8000

**Terminal 2 – frontend**
```bash
cd frontend
npm run dev
```
Runs on http://localhost:3000

## Current state

- Backend returns mock data (no real model calls yet)
- File dropzones are UI-only, actual upload hooks to be wired in later
- Export to PDF just logs to console for now
- Audio player is a placeholder with no src

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