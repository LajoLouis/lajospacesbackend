# LajoSpaces Database Schema

## 🗄️ **MongoDB Collections Overview**

LajoSpaces uses MongoDB with the following main collections:

```
LajoSpaces Database
├── users                    # User accounts and authentication
├── profiles                 # User profiles and preferences
├── properties              # Property listings
├── matches                 # User matching system
├── conversations           # Message conversations
├── messages                # Individual messages
├── photos                  # Photo metadata
├── favorites               # User favorites
├── reviews                 # User reviews
└── notifications           # System notifications
```

## 👤 **Users Collection**

```javascript
{
  _id: ObjectId,
  email: String,              // Unique email address
  password: String,           // Hashed password (bcrypt)
  firstName: String,
  lastName: String,
  isEmailVerified: Boolean,
  isPhoneVerified: Boolean,
  role: String,               // 'user', 'admin', 'moderator'
  status: String,             // 'active', 'suspended', 'deleted'
  lastLogin: Date,
  refreshTokens: [String],    // Array of valid refresh tokens
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  createdAt: Date,
  updatedAt: Date
}
```

### **Indexes:**
```javascript
{ email: 1 }                 // Unique index
{ refreshTokens: 1 }
{ passwordResetToken: 1 }
{ emailVerificationToken: 1 }
```

## 👥 **Profiles Collection**

```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // Reference to users collection
  bio: String,
  occupation: String,
  education: String,          // 'high-school', 'bachelors', etc.
  phone: String,
  dateOfBirth: Date,
  gender: String,             // 'male', 'female', 'other', 'prefer-not-to-say'
  
  // Location information
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    coordinates: {
      type: "Point",
      coordinates: [Number, Number] // [longitude, latitude]
    }
  },
  
  // Lifestyle preferences
  lifestyle: {
    smokingHabits: String,    // 'smoker', 'non-smoker', 'occasional'
    drinkingHabits: String,   // 'never', 'social', 'regular'
    petFriendly: Boolean,
    cleanliness: String,      // 'very-clean', 'clean', 'average', 'messy'
    socialLevel: String,      // 'very-social', 'social', 'quiet', 'private'
    workSchedule: String,     // 'standard', 'night-shift', 'flexible', 'remote'
    sleepSchedule: String,    // 'early-bird', 'night-owl', 'flexible'
    musicPreference: String,  // 'loud', 'moderate', 'quiet', 'headphones-only'
    guestsPolicy: String      // 'frequent', 'occasional', 'rare', 'none'
  },
  
  // Roommate preferences
  preferences: {
    ageRange: {
      min: Number,
      max: Number
    },
    genderPreference: String, // 'male', 'female', 'any'
    budgetRange: {
      min: Number,
      max: Number
    },
    locationPreferences: [String], // Array of preferred cities/areas
    
    // Lifestyle compatibility preferences
    lifestyle: {
      smokingTolerance: String,    // 'yes', 'no', 'outdoor-only'
      drinkingTolerance: String,   // 'yes', 'no', 'moderate'
      petTolerance: String,        // 'yes', 'no', 'cats-only', 'dogs-only'
      cleanlinessExpectation: String,
      socialExpectation: String,
      guestsTolerance: String
    }
  },
  
  // Photos
  photos: [{
    _id: ObjectId,
    url: String,
    thumbnailUrl: String,
    isPrimary: Boolean,
    uploadedAt: Date
  }],
  
  // Profile completion and activity
  completionScore: Number,    // 0-100
  isActive: Boolean,
  lastActiveAt: Date,
  profileViews: Number,
  
  createdAt: Date,
  updatedAt: Date
}
```

### **Indexes:**
```javascript
{ userId: 1 }                           // Unique index
{ "location.coordinates": "2dsphere" }  // Geospatial index
{ isActive: 1, lastActiveAt: -1 }
{ completionScore: -1 }
```

## 🏠 **Properties Collection**

```javascript
{
  _id: ObjectId,
  ownerId: ObjectId,          // Reference to users collection
  title: String,
  description: String,
  type: String,               // 'apartment', 'house', 'condo', 'studio', 'room'
  
  // Pricing
  price: Number,              // Monthly rent
  deposit: Number,
  utilities: {
    included: Boolean,
    estimatedCost: Number
  },
  
  // Location
  location: {
    address: String,
    city: String,
    state: String,
    country: String,
    zipCode: String,
    neighborhood: String,
    coordinates: {
      type: "Point",
      coordinates: [Number, Number]
    }
  },
  
  // Property details
  details: {
    bedrooms: Number,
    bathrooms: Number,
    squareFeet: Number,
    furnished: Boolean,
    availableDate: Date,
    leaseLength: String,      // '6-months', '1-year', 'month-to-month'
    petPolicy: String,        // 'no-pets', 'cats-allowed', 'dogs-allowed', 'all-pets'
    parkingSpaces: Number,
    floor: Number,
    totalFloors: Number
  },
  
  // Amenities
  amenities: [String],        // ['wifi', 'parking', 'laundry', 'gym', 'pool', etc.]
  
  // Photos
  photos: [{
    _id: ObjectId,
    url: String,
    thumbnailUrl: String,
    caption: String,
    isPrimary: Boolean,
    uploadedAt: Date
  }],
  
  // Status and metrics
  isActive: Boolean,
  status: String,             // 'available', 'pending', 'rented', 'inactive'
  viewCount: Number,
  favoriteCount: Number,
  inquiryCount: Number,
  
  // SEO and search
  tags: [String],
  searchKeywords: [String],
  
  createdAt: Date,
  updatedAt: Date
}
```

### **Indexes:**
```javascript
{ ownerId: 1 }
{ "location.coordinates": "2dsphere" }
{ isActive: 1, status: 1 }
{ price: 1 }
{ type: 1 }
{ "details.bedrooms": 1 }
{ "details.availableDate": 1 }
{ tags: 1 }
{ searchKeywords: "text" }              // Text search index
```

## 💕 **Matches Collection**

```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // User who initiated
  targetUserId: ObjectId,     // User being matched with
  status: String,             // 'pending', 'matched', 'rejected', 'expired'
  
  // Matching algorithm data
  compatibilityScore: Number, // 0-100
  compatibilityBreakdown: {
    lifestyle: Number,
    location: Number,
    budget: Number,
    preferences: Number
  },
  
  // Interaction data
  userAction: String,         // 'like', 'pass', 'super-like'
  targetUserAction: String,
  
  // Timestamps
  initiatedAt: Date,
  matchedAt: Date,
  lastInteractionAt: Date,
  expiresAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

### **Indexes:**
```javascript
{ userId: 1, targetUserId: 1 }          // Compound unique index
{ userId: 1, status: 1 }
{ targetUserId: 1, status: 1 }
{ compatibilityScore: -1 }
{ expiresAt: 1 }                        // TTL index
```

## 💬 **Conversations Collection**

```javascript
{
  _id: ObjectId,
  participants: [ObjectId],   // Array of user IDs (always 2 for direct messages)
  type: String,               // 'direct', 'group' (future)
  
  // Last message info for quick access
  lastMessage: {
    messageId: ObjectId,
    content: String,
    senderId: ObjectId,
    timestamp: Date,
    messageType: String
  },
  
  // Conversation metadata
  isActive: Boolean,
  unreadCounts: [{
    userId: ObjectId,
    count: Number
  }],
  
  createdAt: Date,
  updatedAt: Date
}
```

### **Indexes:**
```javascript
{ participants: 1 }
{ "participants": 1, "lastMessage.timestamp": -1 }
```

This schema provides a solid foundation for the LajoSpaces platform with proper indexing for performance and scalability.
