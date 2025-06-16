# 🚗 Serv Motors - Urban Mobility Platform

[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Advanced urban mobility platform for Brazilian transportation professionals, featuring real-time ride requests with audio notifications, comprehensive document management, and PWA mobile app capabilities.

## ✨ Key Features

- 🔊 **Real-time Audio Notifications** for ride requests
- 📱 **PWA Ready** for Android/iOS app stores
- 🇧🇷 **Brazilian Document Validation** (CPF, CNH, CRLV)
- 💳 **Multi-payment Integration** (Asaas, Stripe, PayPal)
- 👨‍💼 **Admin Management System**
- 🌐 **WebSocket Real-time** communication
- 🌍 **Multilingual Support** (Portuguese/English)
- 🗺️ **Google Maps Integration**

## 🛠️ Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for blazing fast development
- Tailwind CSS + shadcn/ui components
- React Query for state management
- Wouter for routing

### Backend
- Node.js + Express.js
- PostgreSQL with Drizzle ORM
- WebSocket server for real-time features
- Passport.js authentication
- Session-based security

### Mobile & PWA
- Capacitor for native mobile apps
- Service Worker for offline support
- Push notifications via Firebase

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/servmotors/servmotors-servmotors_rp_blt.git
cd servmotors-servmotors_rp_blt

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Setup database
npm run db:push

# Start development server
npm run dev
```

## 📱 Mobile Deployment

```bash
# Build PWA
npm run build

# Add mobile platforms
npx cap add android
npx cap add ios

# Sync and open
npx cap sync
npx cap open android  # or ios
```

## 🔧 Environment Variables

```env
DATABASE_URL=postgresql://...
GOOGLE_MAPS_API_KEY=your_key
ASAAS_API_KEY=your_key
FIREBASE_CONFIG=your_config
SESSION_SECRET=your_secret
```

## 📁 Project Structure

```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared schemas
├── migrations/      # Database migrations
└── config/         # Configuration files
```

## 🔄 Development Workflow

1. **Real-time Features**: WebSocket connections for live updates
2. **Audio System**: Automatic ride request notifications
3. **Document Management**: Brazilian compliance (CNH, CRLV)
4. **Payment Processing**: Multiple gateway support
5. **Mobile Ready**: PWA with native app capabilities

## 📚 Documentation

- **Technical Details**: See `replit.md`
- **API Reference**: Server directory comments
- **Contributing**: See `CONTRIBUTING.md`

## 🎯 Core Functionality

### For Drivers
- Real-time ride request notifications with audio alerts
- Document management (CNH, CRLV expiration tracking)
- Earnings tracking and payment integration
- Vehicle registration and approval system

### For Passengers
- Instant ride booking with real-time tracking
- Multiple payment options
- Price negotiation (when enabled)
- Emergency contact system

### For Admins
- Comprehensive driver and vehicle management
- Dynamic pricing configuration
- Feature toggles and system controls
- Analytics and reporting tools

## 🏆 Key Achievements

- ✅ Audio notification system with real passenger data
- ✅ PWA conversion ready for app stores
- ✅ Brazilian document compliance system
- ✅ Real-time WebSocket architecture
- ✅ Multi-payment gateway integration
- ✅ Comprehensive admin controls

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Serv Motors** - Clicou, Chegou! 🚀

Built with ❤️ for the Brazilian transportation community.
