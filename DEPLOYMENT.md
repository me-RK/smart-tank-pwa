# Smart Tank PWA - GitHub Pages Deployment Guide

This guide will help you deploy your Smart Water Tank PWA to GitHub Pages so it can be accessed by end devices.

## Prerequisites

1. A GitHub account
2. Your project pushed to a GitHub repository
3. Node.js and npm installed locally

## Deployment Steps

### 1. Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install gh-pages package:**
   ```bash
   npm install --save-dev gh-pages
   ```

### 2. GitHub Repository Setup

1. **Create a new repository on GitHub** (if not already done):
   - Go to GitHub.com
   - Click "New repository"
   - Name it `smart-tank-pwa`
   - Make it public
   - Don't initialize with README (since you already have files)

2. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/smart-tank-pwa.git
   git push -u origin main
   ```

### 3. Enable GitHub Pages

1. **Go to your repository settings:**
   - Navigate to your repository on GitHub
   - Click on "Settings" tab
   - Scroll down to "Pages" section

2. **Configure GitHub Pages:**
   - Source: "GitHub Actions"
   - This will use the workflow we created

### 4. Deploy Your App

#### Option A: Automatic Deployment (Recommended)
- Simply push to the `main` branch
- GitHub Actions will automatically build and deploy your app
- Your app will be available at: `https://YOUR_USERNAME.github.io/`

#### Option B: Manual Deployment
```bash
npm run deploy
```

### 5. Access Your PWA

Once deployed, your PWA will be available at:
`https://YOUR_USERNAME.github.io/`

## PWA Features

Your app is configured as a Progressive Web App with:
- ✅ Offline capability (via service worker)
- ✅ Installable on mobile devices
- ✅ Standalone display mode
- ✅ Custom theme colors
- ✅ Responsive design

## End Device Access

### Mobile Devices
1. Open the URL in a mobile browser
2. Look for "Add to Home Screen" or "Install App" option
3. The app will be installed like a native app

### Desktop
1. Open the URL in Chrome/Edge
2. Look for the install icon in the address bar
3. Click to install as a desktop app

## Troubleshooting

### Common Issues

1. **404 Error on GitHub Pages:**
   - Ensure the base path in `vite.config.ts` matches your repository name
   - Check that GitHub Pages is enabled in repository settings

2. **PWA not installing:**
   - Ensure HTTPS is enabled (GitHub Pages provides this automatically)
   - Check that the manifest.json is properly configured
   - Verify service worker is registered

3. **Build fails:**
   - Check that all dependencies are installed
   - Ensure TypeScript compilation passes
   - Verify all imports are correct

### Manual Build Test
```bash
npm run build
npm run preview
```

## File Structure

```
smart-tank-pwa/
├── .github/workflows/deploy.yml  # GitHub Actions workflow
├── public/
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service worker
├── src/                         # Source code
├── vite.config.ts              # Vite configuration
└── package.json                # Dependencies and scripts
```

## Updating Your App

1. Make your changes locally
2. Test with `npm run dev`
3. Commit and push to main branch:
   ```bash
   git add .
   git commit -m "Update app"
   git push origin main
   ```
4. GitHub Actions will automatically redeploy

## Security Notes

- Your app is served over HTTPS automatically
- Service worker provides offline functionality
- All assets are properly cached for performance

## Support

If you encounter issues:
1. Check the GitHub Actions tab for build logs
2. Verify all configuration files are correct
3. Test locally before deploying
4. Check browser console for PWA-related errors

Your Smart Tank PWA is now ready for deployment! 🚀
