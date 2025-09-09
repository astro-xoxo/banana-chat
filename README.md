# 🍌 Banana Chat

An AI-powered chat application that creates personalized AI characters with custom profile images using NanoBanana AI technology and Claude conversational AI.

## ✨ Features

- **🤖 AI Character Creation**: Generate custom AI characters with unique personalities
- **🎨 AI Profile Images**: Create character profile images using NanoBanana (Google Gemini) AI
- **💬 Natural Conversations**: Chat with AI characters powered by Claude API
- **🖼️ Image Upload & Crop**: Upload and crop reference images for character generation
- **📱 Anonymous Sessions**: No registration required - start chatting instantly
- **🌐 Multi-language**: Fully localized English interface

## 🚀 Tech Stack

### Frontend
- **Next.js 14** with App Router & TypeScript
- **Tailwind CSS** for styling
- **React Hook Form** for form management
- **React Image Crop** for image editing
- **Lucide React** for icons

### Backend
- **Next.js API Routes** for server-side logic
- **Supabase** for database and authentication
- **PostgreSQL** for data storage with Row Level Security

### AI Services
- **NanoBanana (Google Gemini)** for image generation
- **Claude API (Anthropic)** for conversational AI
- **Custom prompt engineering** for character personalities

### Infrastructure
- **Vercel** for deployment
- **GitHub** for version control
- **Supabase Storage** for image hosting

## 🏗️ Project Structure

```
banana_chat/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── chat/          # Chat endpoints
│   │   ├── generate/      # Image generation
│   │   ├── upload/        # File upload
│   │   └── sessions/      # Session management
│   ├── create/            # Character creation page
│   ├── dashboard/         # User dashboard
│   └── page.tsx           # Home page
├── lib/                   # Utilities & Services
│   ├── services/          # Business logic
│   ├── supabase-client.ts # Database client
│   └── claude.ts          # Claude AI integration
├── components/            # React components
├── types/                 # TypeScript definitions
└── package.json
```

## 🛠️ Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Claude API key
- NanoBanana API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/astro-xoxo/banana-chat.git
   cd banana-chat
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your API keys:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   BANANA_CHAT_API_KEY=your_nanobanana_api_key
   ANTHROPIC_API_KEY=your_claude_api_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 🔌 API Endpoints

### Core APIs
- `POST /api/sessions/create` - Create anonymous session
- `POST /api/generate/profile-nanobanana` - Generate character profile
- `POST /api/chat/claude-banana` - Chat with AI character
- `POST /api/upload/user-image` - Upload reference image

### Character Management
- `GET /api/chatbots` - List user's characters
- `POST /api/chatbots` - Create new character
- `GET /api/chatbots/[id]` - Get character details

## 💻 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run test         # Run tests
```

### Code Quality

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for pre-commit hooks

### Testing

```bash
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Generate coverage report
```

## 🔒 Authentication

The app uses **anonymous sessions** for simplicity:

1. No registration required
2. UUID-based session tokens
3. Stored in localStorage
4. Automatic session creation
5. Session-based data isolation

## 🗄️ Database Schema

### Core Tables

- **anonymous_sessions** - Anonymous user sessions
- **chatbots** - AI character configurations
- **chat_sessions** - Chat conversation sessions
- **chat_messages** - Individual chat messages
- **generated_images** - Image generation tracking

## 🚀 Deployment

### Vercel Deployment

1. **Connect GitHub repository**
2. **Set environment variables** in Vercel dashboard
3. **Deploy automatically** on push to main branch

### Branch Strategy

- `test` - Development branch
- `main` - Production branch (auto-deploys)

### Production URL
```
https://nanobanana-chat.vercel.app
```

## 🎯 Key Features Explained

### Character Creation Flow
1. Upload reference image (optional)
2. Crop face area for AI training
3. Configure character details (name, age, gender, etc.)
4. Generate profile image using NanoBanana AI
5. Create personality prompt for Claude API

### Chat Experience
1. Select or create AI character
2. Start conversation with personalized AI
3. Real-time responses powered by Claude
4. Persistent chat history per session

### Anonymous System
- No user accounts needed
- UUID-based session management
- Local data persistence
- Privacy-focused design

## 🔧 Configuration

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# AI Services  
BANANA_CHAT_API_KEY=AIzaSyxxx          # Google Gemini
ANTHROPIC_API_KEY=sk-ant-xxx           # Claude API

# Optional
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Feature Flags

- Image generation: Enabled by default
- Claude chat: Enabled by default
- Anonymous sessions: Always enabled

## 📊 Performance

- **Build time**: ~2-3 minutes
- **Bundle size**: Optimized with Next.js
- **API response time**: <500ms average
- **Image generation**: 10-30 seconds

## 🐛 Troubleshooting

### Common Issues

**1. Supabase connection failed**
```bash
# Check environment variables
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

**2. Image generation timeout**
- Check NanoBanana API key
- Verify network connectivity
- Monitor API rate limits

**3. Build errors**
```bash
# Clear cache and rebuild
rm -rf .next
npm run build
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Live Demo**: [https://nanobanana-chat.vercel.app](https://nanobanana-chat.vercel.app)
- **GitHub**: [https://github.com/astro-xoxo/banana-chat](https://github.com/astro-xoxo/banana-chat)
- **Documentation**: Check the `/docs` folder for detailed guides

---

**🍌 Experience the future of AI conversation with Banana Chat!**

*Built with ❤️ using Next.js, Supabase, Claude AI, and NanoBanana technology.*