# QRTY

QR code decoder using screen capture or image upload. Capture a section of your screen to automatically scan QR codes, or upload an image file.

## Features

- Capture your screen to automatically detect QR codes
- Upload image files containing QR codes
- Automatically decode QR codes and extract URLs
- Copy or open decoded URLs
- Fully keyboard accessible
- Minimal interface that doesn't block QR codes
- Styled to match johnsy.com design
- Privacy-focused: all processing happens locally in your browser

## Setup

This project uses [mise](https://mise.jdx.dev) for managing software versions and [pnpm](https://pnpm.io) for package management.

### Prerequisites

1. Install mise if you haven't already:

```bash
curl https://mise.run | sh
```

Or follow the [official installation instructions](https://mise.jdx.dev/getting-started.html).

2. Ensure mise is initialised in your shell (add to your shell config if needed):

```bash
eval "$(mise activate zsh)"  # for zsh
# or
eval "$(mise activate bash)" # for bash
```

### Installation

1. Install the required software versions (Node.js and pnpm):

```bash
mise install
```

2. Install project dependencies:

```bash
pnpm install
```

## Usage

The application is a web app hosted at `johnsy.com/QRTY/`. To use it:

1. Click "Capture Screen" to start screen capture (you'll be prompted to select what to share)
2. QR codes will be automatically detected from the captured screen
3. Or click "Upload Image" to upload an image file containing a QR code
4. The decoded URL will be displayed automatically
5. Click "Copy URL" or "Open URL" to use the decoded URL
6. Press `Escape` to stop capture or reset

## Screenshots

![Screenshot of QRTY displaying decoded QR code results](./src/og-image.png)

## Iconography

- Primary app icon:

  ![QRTY app icon showing stylised QR code on cream background](./src/icon-512.png)

- Meta QR code (links to the hosted app):

  ![QR code for https://johnsy.com/QRTY/](./src/qr-code.png)

## Keyboard Shortcuts

- `Space` - Start/stop screen capture
- `Escape` - Stop capture or reset

## Development

- `pnpm start` - Run local development server
- `pnpm run lint` - Run ESLint
- `pnpm run format` - Format code with Prettier
- `pnpm run generate:icons` - Generate icon files from SVG
- `pnpm run generate:og-image` - Generate OpenGraph image
- `pnpm run generate:qr-code` - Generate QR code image for the site URL
- `pnpm run generate:all` - Generate all assets
- `pnpm run build` - Generate all assets (alias for generate:all)

## Requirements

- Modern web browser with screen capture API support (Chrome, Firefox, Edge, Safari)
- HTTPS connection (required for screen capture API)

## Deployment

### GitHub Pages

The app is set up for automatic deployment to GitHub Pages:

1. Push to the `main` branch
2. GitHub Actions will automatically build and deploy to GitHub Pages
3. Configure GitHub Pages settings to serve from the `src` directory

### Manual Deployment

To manually deploy to `johnsy.com/QRTY/`:

1. Generate assets: `pnpm run build`
2. Upload the contents of the `src/` directory to the web server at `/QRTY/`
3. Ensure the `.nojekyll` file is included (prevents Jekyll processing on GitHub Pages)

The app uses only static files (HTML, CSS, JavaScript) and a CDN-hosted library (jsQR), so no server-side processing is required.

## License

MIT
