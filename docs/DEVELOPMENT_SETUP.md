# LajoSpaces Backend - Development Setup

## 🚀 **Quick Start Guide**

### **Prerequisites**
- **Node.js** 18+ (LTS recommended)
- **MongoDB** 6.0+ (Local or Atlas)
- **Redis** 7.0+ (Optional for caching)
- **Git** for version control
- **VS Code** (Recommended IDE)

### **1. Environment Setup**

#### **Install Node.js**
```bash
# Using Node Version Manager (recommended)
nvm install 18
nvm use 18

# Verify installation
node --version
npm --version
```

#### **Install MongoDB**
```bash
# macOS (using Homebrew)
brew tap mongodb/brew
brew install mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb

# Windows
# Download from https://www.mongodb.com/try/download/community
```

#### **Install Redis (Optional)**
```bash
# macOS
brew install redis

# Ubuntu/Debian
sudo apt-get install redis-server

# Windows
# Download from https://redis.io/download
```

### **2. Project Setup**

#### **Clone Repository**
```bash
git clone <backend-repository-url>
cd LajoSpacesBackend
```

#### **Install Dependencies**
```bash
npm install
```

#### **Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

#### **Environment Variables**
```bash
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:8080

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/lajospaces_dev
MONGODB_TEST_URI=mongodb://localhost:27017/lajospaces_test

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRES_IN=7d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@lajospaces.com

# File Upload Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### **3. Database Setup**

#### **Start MongoDB**
```bash
# macOS/Linux
sudo systemctl start mongod

# Or using Homebrew (macOS)
brew services start mongodb-community

# Windows
net start MongoDB
```

#### **Create Database and Collections**
```bash
# Connect to MongoDB
mongosh

# Create database
use lajospaces_dev

# Create collections with validation (optional)
db.createCollection("users")
db.createCollection("profiles")
db.createCollection("properties")
```

#### **Database Indexes**
```javascript
// Run in MongoDB shell
use lajospaces_dev

// Users collection indexes
db.users.createIndex({ email: 1 }, { unique: true })
db.users.createIndex({ refreshTokens: 1 })

// Profiles collection indexes
db.profiles.createIndex({ userId: 1 }, { unique: true })
db.profiles.createIndex({ "location.coordinates": "2dsphere" })

// Properties collection indexes
db.properties.createIndex({ ownerId: 1 })
db.properties.createIndex({ "location.coordinates": "2dsphere" })
db.properties.createIndex({ isActive: 1, status: 1 })
```

### **4. Development Commands**

#### **Start Development Server**
```bash
# Start with hot reload
npm run dev

# Start with debugging
npm run dev:debug

# Start with specific port
PORT=3001 npm run dev
```

#### **Build and Production**
```bash
# Build TypeScript
npm run build

# Start production server
npm start

# Clean build directory
npm run clean
```

#### **Testing**
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts
```

#### **Code Quality**
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run type-check
```

### **5. VS Code Setup**

#### **Recommended Extensions**
```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "mongodb.mongodb-vscode",
    "ms-vscode.vscode-json",
    "humao.rest-client"
  ]
}
```

#### **VS Code Settings**
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

### **6. API Testing**

#### **Using REST Client (VS Code)**
Create `api-tests.http` file:
```http
### Health Check
GET http://localhost:3000/health

### Register User
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}

### Login User
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "password123"
}
```

#### **Using Postman**
Import the Postman collection from `docs/postman/LajoSpaces.postman_collection.json`

### **7. Debugging**

#### **VS Code Debug Configuration**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    }
  ]
}
```

### **8. Docker Setup (Optional)**

#### **Dockerfile**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### **Docker Compose**
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - MONGODB_URI=mongodb://mongo:27017/lajospaces
    depends_on:
      - mongo
      - redis

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  mongo_data:
```

### **9. Troubleshooting**

#### **Common Issues**
- **Port already in use**: Change PORT in .env
- **MongoDB connection failed**: Check MongoDB service status
- **TypeScript errors**: Run `npm run type-check`
- **Module not found**: Delete node_modules and run `npm install`

#### **Logs and Monitoring**
```bash
# View application logs
tail -f logs/app.log

# Monitor MongoDB logs
tail -f /var/log/mongodb/mongod.log

# Check system resources
htop
```

This setup guide ensures a smooth development experience for the LajoSpaces backend.
