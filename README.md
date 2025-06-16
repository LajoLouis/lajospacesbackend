# LajoSpaces Backend API

🏠 **Professional Backend API for LajoSpaces** - Roommate and Property Management Platform

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.0+-green.svg)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-4.18+-lightgrey.svg)](https://expressjs.com/)

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+
- MongoDB 6.0+
- Redis 7.0+ (optional)

### **Installation**
```bash
# Clone repository
git clone <repository-url>
cd LajoSpacesBackend

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### **Health Check**
```bash
curl http://localhost:3000/health
```

## 📁 **Project Structure**

```
LajoSpacesBackend/
├── src/
│   ├── controllers/         # Route handlers and business logic
│   ├── models/             # MongoDB schemas and models
│   ├── routes/             # API route definitions
│   ├── middleware/         # Custom middleware functions
│   ├── services/           # Business logic services
│   ├── utils/              # Helper functions and utilities
│   ├── config/             # Configuration files
│   ├── validators/         # Input validation schemas
│   ├── types/              # TypeScript type definitions
│   └── server.ts           # Main application entry point
├── tests/                  # Test suites and test utilities
├── docs/                   # Comprehensive documentation
│   ├── ARCHITECTURE.md     # System architecture overview
│   ├── DATABASE_SCHEMA.md  # MongoDB schema documentation
│   ├── API_ENDPOINTS.md    # Complete API documentation
│   ├── THIRD_PARTY_PACKAGES.md # Dependencies documentation
│   └── DEVELOPMENT_SETUP.md # Development environment setup
├── scripts/                # Utility scripts and automation
├── logs/                   # Application logs (generated)
├── uploads/                # Temporary file uploads (generated)
└── dist/                   # Compiled JavaScript (generated)
```

## 🎯 **Core Features**

### **🔐 Authentication & Authorization**
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Email verification and password reset
- Secure password hashing with bcrypt

### **👥 User Management**
- Complete user profile system
- Photo upload and management
- Lifestyle preferences and roommate matching
- Profile completion scoring

### **🏠 Property Management**
- Property listing creation and management
- Advanced search with geolocation
- Photo galleries and virtual tours
- Owner dashboard and analytics

### **💕 Matching System**
- Intelligent roommate matching algorithm
- Compatibility scoring based on preferences
- Swipe-based interaction system
- Match expiration and management

### **💬 Real-time Messaging**
- Socket.IO powered real-time chat
- Conversation management
- Message history and pagination
- Online status and typing indicators

### **📱 Additional Features**
- File upload with Cloudinary integration
- Email notifications and alerts
- Advanced search and filtering
- Rate limiting and security measures

## 🛠️ **Technology Stack**

### **Core Technologies**
- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18+
- **Language**: TypeScript 5.0+
- **Database**: MongoDB 6.0+ with Mongoose ODM
- **Caching**: Redis 7.0+
- **Real-time**: Socket.IO 4.7+

### **Security & Authentication**
- **JWT**: jsonwebtoken for authentication
- **Hashing**: bcryptjs for password security
- **Validation**: express-validator for input validation
- **Security**: helmet for HTTP security headers
- **Rate Limiting**: express-rate-limit

### **File Storage & Communication**
- **File Upload**: multer for multipart handling
- **Cloud Storage**: Cloudinary for image management
- **Email**: nodemailer for email services
- **Compression**: compression for response optimization

## 📊 **API Overview**

### **Base URL**
```
Development: http://localhost:3000/api
Production: https://api.lajospaces.com/api
```

### **Main Endpoints**
- **Authentication**: `/api/auth/*` - User registration, login, password reset
- **Users**: `/api/users/*` - User account management
- **Profiles**: `/api/profiles/*` - User profiles and preferences
- **Properties**: `/api/properties/*` - Property listings and search
- **Matches**: `/api/matches/*` - Roommate matching system
- **Messages**: `/api/messages/*` - Real-time messaging
- **Uploads**: `/api/uploads/*` - File upload and management

### **Response Format**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  },
  "pagination": {
    // Pagination info (when applicable)
  }
}
```

## 🔧 **Development**

### **Available Scripts**
```bash
npm run dev          # Start development server with hot reload
npm run build        # Build TypeScript to JavaScript
npm start            # Start production server
npm test             # Run test suite
npm run test:watch   # Run tests in watch mode
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format code with Prettier
npm run type-check   # Run TypeScript type checking
```

### **Environment Variables**
See `.env.example` for all required environment variables including:
- Database connection strings
- JWT secrets
- Email service configuration
- File upload settings
- External API keys

## 🧪 **Testing**

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts
```

## 📚 **Documentation**

Comprehensive documentation is available in the `/docs` folder:

- **[Architecture](docs/ARCHITECTURE.md)** - System design and architecture overview
- **[Database Schema](docs/DATABASE_SCHEMA.md)** - MongoDB collections and schemas
- **[API Endpoints](docs/API_ENDPOINTS.md)** - Complete API documentation
- **[Third-Party Packages](docs/THIRD_PARTY_PACKAGES.md)** - Dependencies and packages
- **[Development Setup](docs/DEVELOPMENT_SETUP.md)** - Development environment guide

## 🚀 **Deployment**

### **Production Checklist**
- [ ] Environment variables configured
- [ ] MongoDB Atlas connection established
- [ ] Redis cache configured
- [ ] Cloudinary account setup
- [ ] Email service configured
- [ ] SSL certificates installed
- [ ] Monitoring and logging setup

### **Docker Support**
```bash
# Build Docker image
docker build -t lajospaces-backend .

# Run with Docker Compose
docker-compose up -d
```

## 🔒 **Security**

- **Authentication**: JWT with refresh token rotation
- **Authorization**: Role-based access control
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API abuse prevention
- **Security Headers**: Helmet.js security middleware
- **Data Encryption**: Bcrypt password hashing
- **CORS**: Configured for frontend domain

## 📈 **Performance**

- **Database Indexing**: Optimized MongoDB indexes
- **Caching**: Redis for session and query caching
- **Compression**: Gzip response compression
- **Connection Pooling**: Efficient database connections
- **Pagination**: Large dataset handling
- **Image Optimization**: Cloudinary transformations

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 **Support**

For support and questions:
- **Documentation**: Check the `/docs` folder
- **Issues**: Create a GitHub issue
- **Email**: support@lajospaces.com

---

**Built with ❤️ for the LajoSpaces community**
