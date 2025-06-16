# Serv Motors - Urban Mobility Platform

## Overview

Serv Motors is a comprehensive urban mobility platform that provides passenger transport, delivery services, and towing services. The system includes interfaces for passengers, drivers, and administrators, featuring real-time tracking, payment processing, and multi-language support.

## System Architecture

The application follows a modern full-stack architecture using a monorepo structure:

### Directory Structure
- `/client`: React-based frontend application with TypeScript
- `/server`: Express.js backend API with TypeScript
- `/shared`: Shared TypeScript schemas and types
- `/migrations`: Database migration files managed by Drizzle
- `/config`: Configuration files including Firebase service account

### Technology Stack
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session-based authentication
- **Real-time**: WebSocket server for live updates
- **Maps**: Google Maps API integration
- **Payments**: Multiple providers (Asaas, Stripe, PayPal)
- **Notifications**: Firebase, Twilio, OneSignal
- **File Storage**: Multer for file uploads
- **Internationalization**: Custom i18n with Portuguese and English

## Key Components

### Frontend Architecture

The frontend uses a component-based architecture with:

- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React Query for server state and data fetching
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: TailwindCSS with CSS custom properties for theming
- **Forms**: React Hook Form with Zod validation
- **Maps Integration**: Google Maps API with custom components

Key features include:
- Multi-user type support (drivers, passengers, admin)
- Real-time ride tracking and updates
- Payment integration with multiple providers
- Emergency contact management
- Address validation and geocoding
- Vehicle management for drivers

### Backend Architecture

The backend follows a modular Express.js architecture:

- **Authentication**: Passport.js with multiple strategies
- **Database**: Drizzle ORM with PostgreSQL
- **Real-time Communication**: WebSocket server for live updates
- **File Management**: Multer for document and image uploads
- **External Services**: Integration with payment providers, maps, and notification services

Key services include:
- User management (drivers, passengers, admins)
- Vehicle registration and approval
- Ride matching and tracking
- Payment processing
- Notification system
- Address validation
- Emergency contact management

### Database Schema

The database uses PostgreSQL with comprehensive schemas for:

- **Users/Drivers**: Complete driver profiles with document management
- **Passengers**: Passenger information and preferences
- **Vehicles**: Vehicle registration and approval workflow
- **Rides**: Ride requests, tracking, and history
- **Payments**: Transaction history and wallet management
- **Emergency Contacts**: Safety and emergency contact system
- **Pricing**: Dynamic pricing tables by region and vehicle type
- **Administrative**: Super admin and permission management

## Data Flow

### User Registration and Authentication
1. Users register as drivers or passengers
2. Document verification for drivers (CNH, vehicle documents)
3. Admin approval workflow
4. Session-based authentication with Passport.js

### Ride Request Flow
1. Passenger requests ride with origin/destination
2. System calculates pricing and finds available drivers
3. Real-time matching and acceptance
4. Live tracking during ride
5. Payment processing and receipt generation

### Real-time Updates
- WebSocket connections for live updates
- Driver location tracking
- Ride status updates
- Emergency notifications

## External Dependencies

### Core Services
- **Google Maps API**: Geocoding, directions, distance calculation
- **Firebase**: Push notifications and real-time features
- **Payment Providers**: Asaas (primary), Stripe, PayPal
- **Communication**: Twilio for SMS, OneSignal for push notifications

### Development Tools
- **Drizzle Kit**: Database migrations and schema management
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type safety across the entire stack

### Authentication & Security
- **Passport.js**: Authentication middleware
- **bcrypt**: Password hashing
- **Session management**: Express sessions with PostgreSQL store

## Deployment Strategy

### Development Environment
- Uses Replit with Node.js 20 and PostgreSQL 16
- Hot reload with Vite for frontend development
- Development server runs on port 5000

### Production Deployment
- Autoscale deployment target configured
- Build process compiles both frontend and backend
- PostgreSQL database with connection pooling via Neon

### Environment Configuration
- Database URL from environment variables
- API keys for external services
- Session secrets for authentication

## Changelog

- June 16, 2025: Completed automated GitHub upload to https://github.com/servmotors/servmotors-servmotors_rp_blt.git
  - Successfully uploaded core project files including README, package.json, server backend, and client frontend
  - Resolved Git authentication issues in Replit by implementing direct API upload method
  - Project documentation and PWA configuration files uploaded to GitHub repository
  - Main application structure now available on GitHub with professional documentation
- June 16, 2025: Finalized ride-hailing system with real passenger data integration
  - Removed all test rides with fake passenger data (passengerId: 0)
  - System now works exclusively with authenticated passengers from database
  - WebSocket notifications fetch real passenger names and phone numbers
  - Created real passenger "João Silva Santos" for testing authentic workflow
  - Audio alerts and popup system functional with genuine ride requests only
  - PWA conversion completed with service worker and install button
  - Capacitor configured for Android/iOS app store deployment
- June 15, 2025: Implemented complete ride-hailing system with audio notifications and global popup
  - Integrated audio file (Chamada_1750005114210.mp3) for ride request alerts
  - Created global floating popup system that appears on ANY driver page when rides are available
  - Added "Accept" and "Decline" buttons for ride notifications with proper backend processing
  - Extended database schema with driver_id and accepted_at fields in ride_requests table
  - Fixed backend authentication checks and API endpoints for ride acceptance/decline functionality
  - Implemented real-time ride status updates preventing multiple active rides per driver
  - Added comprehensive error handling and logging for ride acceptance workflow
  - Created automated popup management that stops audio and closes popup when rides are accepted
  - System successfully processes ride requests from passengers to driver acceptance flow
- June 14, 2025: Implemented CPF validation in driver registration form
  - Added comprehensive Brazilian CPF validation algorithm with official digit verification
  - Enhanced field with real-time formatting (000.000.000-00) and visual feedback
  - Added error detection with red border styling and clear validation messages
  - Prevents submission of invalid CPFs while maintaining smooth user experience
  - Validates both formatted and unformatted CPF inputs with automatic error clearing
- June 14, 2025: Added CRLV Schedule to admin navigation menu
  - Integrated CRLV schedule page into AdminSidebar navigation menu for easy access
  - Positioned "Cronograma CRLV" menu item between "Motoristas" and "Tabelas de valores"
  - Added FileSpreadsheet icon and descriptive tooltip for clear identification
  - Menu item highlights when active and provides direct navigation to /admin/crlv-schedule
  - Maintains existing button access from drivers page while adding convenient sidebar navigation
- June 14, 2025: Implemented driver ride requests interface for real-time ride acceptance
  - Created dedicated driver ride requests page at /driver/ride-requests for drivers to view pending rides
  - Added backend API endpoint /api/driver/ride-requests/pending to fetch pending ride requests for authenticated drivers
  - Integrated comprehensive ride request details including passenger info, pickup/destination locations, and pricing
  - Implemented real-time WebSocket notifications for new ride requests with visual toast notifications
  - Added ride acceptance functionality using existing acceptRide function from useRealTime hook
  - Enhanced driver workflow with manual refresh capability and loading states for better UX
  - Secured endpoint with driver authentication verification and proper error handling
  - Integrated route into application routing system with protected route for driver-only access
  - Driver interface displays estimated distance, duration, price, and passenger contact information
  - System automatically removes accepted rides from pending list for real-time status updates
- June 14, 2025: Implemented comprehensive Brazilian CRLV expiration date system
  - Created complete table of accurate CRLV vencimento dates for all 27 Brazilian states
  - Removed default/fallback dates in favor of state-specific accurate schedules
  - Added automated recalculation system for all existing vehicle CRLV dates
  - Implemented backend endpoint /api/admin/recalculate-crlv-dates for bulk updates
  - Added admin "Recalcular CRLV" button in drivers page for one-click date corrections
  - CRLV block dates automatically calculated as 1 day before expiration date
  - System now supports: SP, MG, RJ, RS, PR, SC, BA, GO, PE, CE, ES, PA, MA, PI, AL, SE, PB, RN, TO, MT, MS, RO, AC, AM, RR, AP, DF
  - Each state has unique schedule based on plate final digit (0-9) with correct monthly distribution
  - Database automatically updated with accurate dates when admin triggers recalculation
  - Frontend calculates dates in real-time using comprehensive state-based algorithm
- June 14, 2025: Updated button hover styling for "Desbloquear" button
  - Changed hover background color to #F59E0B (amber) and text color to #050505 (black)
  - Applied to unblock button in driver details modal for improved visual feedback
- June 14, 2025: Enhanced driver registration form with Brazilian documentation fields
  - Added CPF number field with automatic formatting (000.000.000-00)
  - Added CNH number field with numeric validation
  - Added CNH category dropdown with all Brazilian license categories (A, B, C, D, E, AB, AC, AD, AE)
  - Added EAR (Exerce Atividade Remunerada) checkbox with improved visual feedback
  - Enhanced checkbox with green styling when selected for clear visual indication
  - Updated database schema with remunerated_activity column
  - Modified backend registration endpoint to handle new Brazilian documentation fields
  - Updated form review section to display all new documentation information
- June 14, 2025: Fixed gender update modal persistence issue
  - Resolved problema do modal de atualização de gênero aparecer repetidamente
  - Adicionada invalidação adequada do cache do React Query após atualização do gênero
  - Implementado refresh forçado dos dados do usuário para sincronizar estado do frontend
  - Corrigido aviso de acessibilidade do DialogContent com aria-describedby
  - Adicionado timeout e reload da página para garantir atualização completa do estado
  - Sistema agora verifica corretamente o campo gender_updated no banco de dados
  - Modal só aparece para motoristas que ainda não atualizaram as informações de gênero
- June 14, 2025: Fixed admin sidebar scroll position maintenance and database schema issues
  - Resolved admin sidebar auto-scroll problem when clicking navigation buttons
  - Implemented robust scroll position preservation using multiple restoration attempts
  - Fixed TypeError in pricing-algorithm page by adding type checking for parsePrice/parsePercentage functions
  - Resolved 500 error in /api/rides endpoint by adding missing columns to rides table
  - Added driver_id, driver_name, driver_photo, driver_rating, vehicle_name, vehicle_plate, price, estimated_arrival_time, current_latitude, current_longitude columns
  - Admin navigation now maintains exact scroll position when switching between pages
- June 14, 2025: Implemented mandatory gender field update system for existing drivers
  - Added gender column to drivers table with enum values (male, female, other)
  - Created mandatory gender update modal with Portuguese interface (Homem, Mulher, Outros)
  - Added gender_updated boolean field to track completion status
  - Implemented one-time mandatory update system that blocks dashboard access
  - Modal appears automatically for existing drivers who haven't updated gender info
  - New drivers are marked as updated during registration process
  - Added API endpoint /api/driver/update-gender for processing updates
  - Fixed accessibility warnings with proper DialogDescription
  - System ensures passenger driver preference functionality is fully supported
- June 14, 2025: Migrated pricing data from hardcoded server values to PostgreSQL database
  - Fixed critical architecture issue: Pricing data now stored in pricing_tables instead of hardcoded in routes.ts
  - API /api/pricing/passenger now reads from database with automatic fallback data insertion
  - Added missing monthly_plan_discount column to pricing_tables schema
  - Enables dynamic pricing management through admin interface without code deployments
  - Maintains data integrity and provides audit trail for pricing changes
- June 14, 2025: Implemented comprehensive admin interface improvements and pricing system fixes
  - Fixed bug: Disabled price negotiation feature in passenger interface by updating feature toggle in database
  - Fixed Collection Points page with complete database schema alignment
  - Added AdminLayout menu navigation to Collection Points page for consistency
  - Created reusable DeleteConfirmationDialog component for standardized deletion workflows
  - Implemented delete confirmation system across admin pages with red hover effects
  - Fixed Feature Toggles database constraint error by removing foreign key restriction
  - Updated Feature Toggle buttons to show green background when active and proper hover states
  - Corrected form fields for proper data collection (CNPJ, company details, full address)
  - Fixed controlled component warnings in React
  - Successfully tested collection point creation and feature toggle functionality
  - Implemented price negotiation feature in ride booking flow (NewRideForm component)
  - Fixed dynamic pricing system to properly toggle between enabled/disabled states
  - Added comprehensive logging for dynamic pricing calculations (weather, traffic, peak hours, demand)
  - Corrected negotiation feature to only display when enabled by admin and feature toggle
  - Fixed API caching issues for negotiation settings with forced refresh
  - Enhanced dynamic pricing with additional factors (demand simulation, night conditions)
  - Implemented real-time synchronization system for admin-passenger configuration updates
  - Created useRealTimeSync hook with intelligent polling to replace complex WebSocket
  - Integrated real-time sync in NewRideForm for automatic configuration updates
  - System now updates passenger interface when admin changes feature toggles within 2 seconds
  - Fixed critical WebSocket server errors by declaring missing authTimeout variable
  - Resolved NewRideForm component initialization errors by reorganizing state declarations
  - Fixed variable access before initialization issues in React components
  - WebSocket connections now establish properly without undefined reference errors
  - Application loads successfully without JavaScript runtime errors
- June 13, 2025: Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.