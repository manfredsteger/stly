# STL Editor Pro

STL Editor Pro is a modern, web-based full-stack application for viewing, analyzing, modifying, and exporting 3D STL models.

## Features
- **Upload & View**: Load multiple `.stl` or `.stlc` files via drag-and-drop.
- **Transform**: Move, rotate, and scale 3D objects within the scene.
- **Analyze**: Automatically calculate bounding boxes, volume, and triangle counts.
- **CSG Operations (Merge)**: Fuse multiple intersecting 3D objects into a single mesh.
- **Slicing & Splitting**: Cut geometry along planes or divide parts.
- **Mirror**: Mirror objects along the X, Y, or Z axes.
- **Export**: Export single transformed models, or the entire combined scene.
- **AI Analysis**: Uses Google's Gemini API for intelligent, contextual analysis of the current 3D geometry structure.

---

## Local Deployment with Docker 🐳 (Zero-Conf)

The application is containerized and comes with a `docker-compose.yml` file for quick, reproducible local deployments. Out of the box, it requires zero configuration to start.

### 1. Prerequisites
- Install [Docker Desktop](https://docs.docker.com/get-docker/) (or Docker Engine + Docker Compose).

### 2. Build & Run
From the root of the project, run:
```bash
docker compose up --build
```
*(To run it safely in the background as a daemon, use `docker compose up -d --build`)*

### 3. Access the App
Open your web browser and navigate to: **http://localhost:3000**

### 4. Optional: Enable AI Analysis Features
To utilize the AI analysis feature, you can provide a Gemini API Key:
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and add your API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Restart your container: `docker compose up -d`

### 5. Stopping the Container
Press `Ctrl+C` in your terminal, or if running in the background, execute:
```bash
docker compose down
```

---

## Local Development (Without Docker)

If you prefer to run the app natively on your machine:

1. **Install Node.js** (v20+ recommended).
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment setup**: 
   Create a `.env` file just like in the Docker setup.
4. **Start the Development Server**:
   ```bash
   npm run dev
   ```
5. Navigate to http://localhost:3000.

---

## Building for Production natively

To build the client SPA and compile the Express backend down to a production-ready package:
```bash
npm run build
npm start
```
