# LajoSpaces API Endpoints

## 🌐 **Base URL**
```
Development: http://localhost:3000/api
Production: https://api.lajospaces.com/api
```

## 🔐 **Authentication**

### **POST /auth/register**
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isEmailVerified": false
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    }
  }
}
```

### **POST /auth/login**
Authenticate user and return tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

### **POST /auth/refresh**
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

### **POST /auth/logout**
Logout user and invalidate tokens.

**Headers:** `Authorization: Bearer <access_token>`

### **POST /auth/forgot-password**
Send password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### **POST /auth/reset-password**
Reset password with token.

**Request Body:**
```json
{
  "token": "reset_token",
  "password": "newSecurePassword123"
}
```

### **POST /auth/verify-email**
Verify email address with token.

**Request Body:**
```json
{
  "token": "verification_token"
}
```

## 👤 **Users**

### **GET /users/me**
Get current user information.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "role": "user",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### **PUT /users/me**
Update current user information.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith"
}
```

### **DELETE /users/me**
Delete current user account.

**Headers:** `Authorization: Bearer <access_token>`

### **GET /users/:id**
Get public user profile by ID.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "firstName": "John",
    "lastName": "Doe",
    "profilePicture": "image_url",
    "bio": "Looking for a great roommate!",
    "location": {
      "city": "San Francisco",
      "state": "CA"
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## 👥 **Profiles**

### **GET /profiles/me**
Get current user's complete profile.

**Headers:** `Authorization: Bearer <access_token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "profile_id",
    "userId": "user_id",
    "bio": "Looking for a clean, friendly roommate!",
    "occupation": "Software Engineer",
    "education": "bachelors",
    "phone": "+1-555-123-4567",
    "location": {
      "city": "San Francisco",
      "state": "CA",
      "country": "USA",
      "coordinates": {
        "type": "Point",
        "coordinates": [-122.4194, 37.7749]
      }
    },
    "lifestyle": {
      "smokingHabits": "non-smoker",
      "drinkingHabits": "social",
      "petFriendly": true,
      "cleanliness": "very-clean"
    },
    "preferences": {
      "ageRange": { "min": 22, "max": 35 },
      "genderPreference": "any",
      "budgetRange": { "min": 1000, "max": 2500 }
    },
    "photos": [
      {
        "id": "photo_id",
        "url": "image_url",
        "thumbnailUrl": "thumbnail_url",
        "isPrimary": true
      }
    ],
    "completionScore": 85,
    "isActive": true
  }
}
```

### **PUT /profiles/me**
Update current user's profile.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "bio": "Updated bio text",
  "occupation": "Senior Software Engineer",
  "lifestyle": {
    "smokingHabits": "non-smoker",
    "drinkingHabits": "social"
  }
}
```

### **POST /profiles/photos**
Upload profile photos.

**Headers:** 
- `Authorization: Bearer <access_token>`
- `Content-Type: multipart/form-data`

**Request Body:** FormData with photo files

**Response:**
```json
{
  "success": true,
  "message": "Photos uploaded successfully",
  "data": {
    "photos": [
      {
        "id": "photo_id",
        "url": "image_url",
        "thumbnailUrl": "thumbnail_url",
        "isPrimary": false
      }
    ]
  }
}
```

### **DELETE /profiles/photos/:photoId**
Delete a profile photo.

**Headers:** `Authorization: Bearer <access_token>`

### **PUT /profiles/photos/:photoId/primary**
Set photo as primary.

**Headers:** `Authorization: Bearer <access_token>`

## 🏠 **Properties**

### **GET /properties**
Get properties with filters and pagination.

**Query Parameters:**
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `minPrice` (number): Minimum price filter
- `maxPrice` (number): Maximum price filter
- `type` (string): Property type filter
- `city` (string): City filter
- `bedrooms` (number): Number of bedrooms
- `lat` (number): Latitude for location search
- `lng` (number): Longitude for location search
- `radius` (number): Search radius in miles (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "properties": [
      {
        "id": "property_id",
        "title": "Beautiful 2BR Apartment",
        "description": "Modern apartment with great amenities",
        "type": "apartment",
        "price": 2500,
        "location": {
          "address": "123 Market St",
          "city": "San Francisco",
          "state": "CA",
          "coordinates": {
            "type": "Point",
            "coordinates": [-122.4194, 37.7749]
          }
        },
        "details": {
          "bedrooms": 2,
          "bathrooms": 1,
          "squareFeet": 900,
          "furnished": true
        },
        "photos": [
          {
            "url": "image_url",
            "thumbnailUrl": "thumbnail_url",
            "isPrimary": true
          }
        ],
        "owner": {
          "id": "owner_id",
          "firstName": "Jane",
          "lastName": "Smith"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalProperties": 100,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### **GET /properties/:id**
Get property details by ID.

### **POST /properties**
Create new property listing.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "title": "Beautiful 2BR Apartment",
  "description": "Modern apartment with great amenities",
  "type": "apartment",
  "price": 2500,
  "location": {
    "address": "123 Market St",
    "city": "San Francisco",
    "state": "CA"
  },
  "details": {
    "bedrooms": 2,
    "bathrooms": 1,
    "squareFeet": 900,
    "furnished": true
  },
  "amenities": ["wifi", "parking", "laundry"]
}
```

### **PUT /properties/:id**
Update property listing.

**Headers:** `Authorization: Bearer <access_token>`

### **DELETE /properties/:id**
Delete property listing.

**Headers:** `Authorization: Bearer <access_token>`

This API documentation provides a comprehensive overview of all available endpoints for the LajoSpaces platform.
