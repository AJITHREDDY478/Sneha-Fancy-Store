# Deploying Sneha Fancy Store to GitHub Pages

Follow these steps to deploy the app to GitHub Pages:

## Step 1: Initialize Git Repository
```bash
cd c:\Users\Admin\Desktop\Sneha Fancy Store
git init
git add .
git commit -m "Initial commit"
```

## Step 2: Create GitHub Repository
1. Go to https://github.com/new
2. Create a new repository named `Sneha-Fancy-Store`
3. **Important**: Make sure the repository name matches the `base` setting in `vite.config.js` (`/Sneha-Fancy-Store/`)

## Step 3: Add Remote and Push
```bash
git remote add origin https://github.com/YOUR_USERNAME/Sneha-Fancy-Store.git
git branch -M main
git push -u origin main
```
Replace `YOUR_USERNAME` with your GitHub username.

## Step 4: Deploy to GitHub Pages
```bash
npm run deploy
```

This will:
1. Build the production version: `npm run build`
2. Deploy the `dist` folder to GitHub Pages using `gh-pages`

## Step 5: Configure GitHub Pages Settings
1. Go to your repository on GitHub
2. Go to **Settings** → **Pages**
3. Under "Build and deployment":
   - Source: Select **Deploy from a branch**
   - Branch: Select **gh-pages** and **/ (root)**
4. Wait a few minutes for the deployment to complete

## Step 6: Access Your App
Your app will be available at: `https://YOUR_USERNAME.github.io/Sneha-Fancy-Store/`

## Notes
- All data is stored in browser's localStorage, so each user's data is local to their browser
- The app works completely offline after the first load
- No backend server is required
- To update, just make changes, commit, push, and run `npm run deploy` again

## Troubleshooting
- If images (logo) don't load, ensure they are in the `public` folder
- If routing doesn't work, make sure `base` in `vite.config.js` matches your repository name
- Clear browser cache if you see old versions after deploying
