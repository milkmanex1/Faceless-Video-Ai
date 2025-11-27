# AI Video Frontend

A React-based frontend for the AI Video generation platform, built with Next.js, Tailwind CSS, and Radix UI components.

## Features

- **Modular Component Architecture**: Clean separation of concerns with reusable components
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Form Validation**: Controlled components with proper state management
- **API Integration**: Connected to backend endpoints for video creation and management
- **Real-time Status Updates**: Polling mechanism for video processing status

## Component Structure

```
ai-video-frontend/
├── components/
│   ├── Layout.jsx          # Main layout wrapper
│   ├── Sidebar.jsx         # Navigation sidebar
│   ├── Navbar.jsx          # Top navigation bar
│   └── ui/                 # Reusable UI components
│       ├── button.jsx
│       ├── card.jsx
│       ├── select.jsx
│       ├── radio-group.jsx
│       ├── label.jsx
│       └── switch.jsx
├── pages/
│   ├── CreateSeriesPage.jsx # Main form page
│   ├── _app.js             # Next.js app wrapper
│   └── index.js            # Home page
├── services/
│   └── api.js              # API service layer
└── lib/
    └── utils.js            # Utility functions
```

## API Endpoints

The frontend connects to the following backend endpoints:

1. **POST /api/videos** - Create a new video
2. **GET /api/videos/user/:user_id** - Get all videos for a user
3. **GET /api/videos/:id** - Get a single video by ID
4. **POST /api/render/:id** - Start rendering a video

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   ```

3. **Start Development Server**:
   ```bash
   npm run dev
   ```

4. **Build for Production**:
   ```bash
   npm run build
   npm start
   ```

## Usage

1. Navigate to the create page
2. Fill out the form with your video preferences:
   - Destination (where to post)
   - Content topic
   - Voice selection
   - Art style
   - Aspect ratio
   - Language
   - Duration
   - Background music toggle
3. Submit the form to create a video series
4. The system will automatically start processing and provide status updates

## Key Features

### Form State Management
- All form elements are controlled components using `useState`
- Real-time validation and error handling
- Loading states during API calls

### API Integration
- Centralized API service with error handling
- Automatic polling for video processing status
- Proper error messages and success feedback

### Responsive Design
- Mobile-first approach
- Consistent spacing and typography
- Accessible form controls

## Dependencies

- **Next.js 14** - React framework
- **Tailwind CSS** - Utility-first CSS framework
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **Class Variance Authority** - Component variant management

## Development

The codebase follows these principles:
- **DRY (Don't Repeat Yourself)**: Reusable components and utilities
- **Separation of Concerns**: Clear component boundaries
- **Accessibility**: ARIA labels and keyboard navigation
- **Performance**: Optimized rendering and API calls
