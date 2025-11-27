# Quick Setup Guide

## 1. Install Dependencies
```bash
cd ai-video-frontend
npm install
```

## 2. Create Environment File
Create a `.env.local` file in the root directory with:
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## 3. Start Development Server
```bash
npm run dev
```

## 4. Access the Application
Open http://localhost:3001 in your browser

## 5. Backend Requirements
Make sure your backend is running on http://localhost:3000 with the following endpoints:
- POST /api/videos
- GET /api/videos/user/:user_id  
- GET /api/videos/:id
- POST /api/render/:id

## Troubleshooting

### Port Conflicts
If port 3001 is in use, Next.js will automatically use the next available port.

### API Connection Issues
- Verify the backend is running on port 3000
- Check the .env.local file has the correct API URL
- Ensure CORS is properly configured on the backend

### Build Issues
If you encounter build issues, try:
```bash
rm -rf node_modules package-lock.json
npm install
```
