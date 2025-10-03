# Vigilo

This is a portable security camera app built with Preact and Vite. It utilizes computer vision and image processing libraries to provide its core functionality.

## Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/eifr/Vigilo.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd Vigilo
    ```
3.  Install the dependencies:
    ```bash
    npm install
    # or
    yarn install
    # or
    bun install
    ```

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.
Open [http://localhost:5173](http://localhost:5173) to view it in the browser. The page will reload if you make edits.

### `npm run build`

Builds the app for production to the `dist` folder. It correctly bundles Preact in production mode and optimizes the build for the best performance.

### `npm run preview`

Serves the production build locally to preview it before deploying.

## Key Dependencies

- **Preact**: A fast 3kB alternative to React with the same modern API.
- **Vite**: A modern frontend build tool that provides an extremely fast development environment.
- **OpenCV.js**: The JavaScript version of the OpenCV library for computer vision tasks.
- **diffyjs**: A library for image comparison.
- **qrcode.react**: A React component for generating QR codes.
