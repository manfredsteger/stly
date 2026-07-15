# STL Editor Pro 🎨✨

<div align="center">
  <h3>A modern, web-based full-stack application for viewing, analyzing, modifying, and exporting 3D STL models.</h3>
</div>

---

## 🚀 Features

- 📂 **Upload & View**: Load multiple `.stl` or `.stlc` files via drag-and-drop.
- 📐 **Transform**: Move, rotate, and scale 3D objects within the scene natively with an intuitive gizmo.
- 📊 **Analyze**: Automatically calculate bounding boxes, volume, and triangle counts for your geometry.
- ✂️ **CSG Operations (Merge & Cut)**: Fuse multiple intersecting 3D objects into a single mesh or carve out geometry with cutting tools.
- 📏 **Slicing & Splitting**: Cut geometry along dynamic planes or divide multi-part geometries seamlessly.
- 🪞 **Mirroring**: Mirror objects along the X, Y, or Z axes with a single click.
- 🤖 **AI Geometry Analysis**: Uses Google's Gemini API for intelligent, contextual analysis of your 3D structure and composition.
- 🚀 **OpenSCAD Integration**: Compile standard `.scad` code right in the browser!
- 📤 **Export**: Export individual transformed models, or merge the entire scene into one monolithic STL file for 3D printing.

---

## 🐋 Zero-Conf Local Deployment with Docker

STL Editor Pro is fully containerized with a simple `docker-compose.yml` for reproducible local deployments. Out of the box, it requires **zero configuration**.

### 1. Prerequisites
- Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Docker Compose).

### 2. Build & Run (The Easy Way)
We have included a highly convenient `Makefile` to let you build and run everything smoothly!

```bash
# To build and start the application in detached mode (Zeroconf)
make complete

# To stop the application
make down

# To view server logs
make logs
```

### 3. Access the App
Open your web browser and navigate to:
**http://localhost:3333**

---

## 🛠 Native Local Development (Without Docker)

If you prefer to run the app natively on your machine to contribute and edit code:

1. **Install Node.js** (v20+ recommended).
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Start the Development Server:**
   ```bash
   npm run dev
   ```
   Navigate to **http://localhost:3333**.

---

## 🧠 Enabling AI Analysis

To utilize the AI analysis feature powered by Gemini, you can easily provide a Gemini API Key:

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` and add your API key:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```
3. Restart your container (`make complete` or `docker compose up -d`).

---

## 🧱 Building for Production (Natively)

To build the client SPA and compile the Express backend down to a production-ready package without Docker:

```bash
npm run build
npm start
```

---

## 📜 Changelog

### v1.1.0
- **Feat**: Added OpenSCAD Integration to write and compile `.scad` to `.stl` directly via a background Web Worker!
- **Feat**: Introduced dynamic `Makefile` for zero-configuration Docker orchestration.
- **Chore**: Migrated the default container deployment port to **3333** to prevent standard port collisions.
- **Refactor**: Cleaned up project structure by organizing components and utilities into a clean `/src` folder hierarchy.
- **Fix**: Adjusted the global Viewer lifecycle to resolve lingering memory leaks on hot module replacements.

### v1.0.0
- Initial Release of STL Editor Pro!
- Implemented robust STL Loading with drag & drop handling.
- Integrated Three.js and `three-bvh-csg` for high-performance Constructive Solid Geometry.

---

<div align="center">
  <b>Built with ❤️ using React, Three.js, Express, and Vite.</b>
</div>
