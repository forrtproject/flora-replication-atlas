# FLoRA Replication Atlas

![GitHub stars](https://img.shields.io/github/stars/forrtproject/fred_repl_landing_page)
![GitHub forks](https://img.shields.io/github/forks/forrtproject/fred_repl_landing_page)
![GitHub issues](https://img.shields.io/github/issues/forrtproject/fred_repl_landing_page)
![GitHub commits](https://img.shields.io/github/last-commit/forrtproject/fred_repl_landing_page)

Search by DOI, title, or author to instantly check whether a study has been replicated. Browse replication outcomes across psychology and the social sciences — powered by FORRT's Replication Database (FReD).

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Workflow Summary](#workflow-summary)
- [Getting Started](#getting-started)
- [Contributing](#contributing)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)

## Overview

The FLoRA Replication Atlas allows users to check whether a scientific study has been replicated by searching with a DOI, title, author, or year. It fetches metadata from the FReD API, displays original and replication study details, and provides replication outcome summaries.

## Features

- Search by DOI, title, author, or year
- Multi-DOI batch lookup
- Replication outcome visualizations (success, mixed, failed)
- Detailed study cards with APA/BibTeX citation export
- PDF access via Unpaywall integration
- Export search results to PDF

## Workflow Summary

1. **User Input**: The user enters a DOI, title, author, or year in the search bar.
2. **API Request**: The tool sends a request to the FReD API.
3. **Response Handling**:
   - If data is found, the original study metadata is rendered, replication studies are listed with outcome badges, and citation tools are provided.
   - If no data is found, a fallback message is shown with a link to suggest a new replication entry.
4. **Detail View**: Each study card shows replications, reproductions, and target studies with outcome indicators.

## Getting Started

To get started, you'll need to install the dependencies:

```bash
npm install
```

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in development mode.
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm run build`

Builds the app for production to the `dist` folder.
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.
Your app is ready to be deployed!

## Contributing

Contributions are welcome! Please open an issue or submit a pull request with your changes.

## Deployment

The app is deployed to GitHub Pages via the [deploy workflow](.github/workflows/deploy.yml). Pushing to `main` triggers an automatic build and deploy.

Live at: [forrt.org/flora-replication-atlas](https://forrt.org/flora-replication-atlas/)
