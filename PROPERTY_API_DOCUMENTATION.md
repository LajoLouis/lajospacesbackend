# LajoSpaces Property Management API Documentation

## Overview
This document outlines the comprehensive Property Management System API endpoints for LajoSpaces, a Nigerian-focused housing and roommate matching platform.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## Property Management Endpoints

### 1. Property CRUD Operations

#### Create Property
- **POST** `/properties`
- **Auth Required:** Yes
- **Description:** Create a new property listing
- **Body:** Property data (see validation schema)
- **Response:** Created property object

#### Get All Properties
- **GET** `/properties`
- **Auth Required:** No
- **Description:** Get all active properties with filtering and pagination
- **Query Parameters:**
  - `page` (number): Page number (default: 1)
  - `limit` (number): Items per page (default: 20, max: 100)
  - `propertyType` (string|array): Filter by property type
  - `listingType` (string|array): Filter by listing type
  - `minPrice` (number): Minimum rent price
  - `maxPrice` (number): Maximum rent price
  - `bedrooms` (number): Number of bedrooms
  - `bathrooms` (number): Number of bathrooms
  - `city` (string): Filter by city
  - `state` (string): Filter by Nigerian state
  - `area` (string): Filter by area
  - `search` (string): Text search in title/description
  - `sortBy` (string): Sort field (default: 'createdAt')
  - `sortOrder` (string): 'asc' or 'desc' (default: 'desc')

#### Get Property by ID
- **GET** `/properties/:id`
- **Auth Required:** No
- **Description:** Get a specific property by ID
- **Response:** Property details with owner info

#### Update Property
- **PUT** `/properties/:id`
- **Auth Required:** Yes (Owner only)
- **Description:** Update property details
- **Body:** Updated property data

#### Delete Property
- **DELETE** `/properties/:id`
- **Auth Required:** Yes (Owner only)
- **Description:** Delete a property listing

#### Publish Property
- **POST** `/properties/:id/publish`
- **Auth Required:** Yes (Owner only)
- **Description:** Publish a draft property to make it active

### 2. Property Search Endpoints

#### Advanced Property Search
- **POST** `/properties/search`
- **Auth Required:** No
- **Description:** Advanced search with complex filters
- **Body:**
```json
{
  "query": "string",
  "propertyType": ["apartment", "house"],
  "listingType": ["rent", "roommate"],
  "minPrice": 50000,
  "maxPrice": 200000,
  "bedrooms": { "min": 1, "max": 3 },
  "bathrooms": { "min": 1, "max": 2 },
  "location": {
    "city": "Lagos",
    "state": "Lagos",
    "coordinates": {
      "latitude": 6.5244,
      "longitude": 3.3792,
      "radius": 5000
    }
  },
  "amenities": {
    "wifi": true,
    "parking": true,
    "security": true
  },
  "rules": {
    "petsAllowed": true,
    "smokingAllowed": false
  },
  "availableFrom": "2024-01-01",
  "roommatePreferences": {
    "gender": "any",
    "ageRange": { "min": 25, "max": 35 }
  },
  "page": 1,
  "limit": 20,
  "sortBy": "createdAt",
  "sortOrder": "desc"
}
```

#### Nearby Properties Search
- **GET** `/properties/search/nearby`
- **Auth Required:** No
- **Description:** Find properties near a specific location
- **Query Parameters:**
  - `latitude` (number, required): Latitude coordinate
  - `longitude` (number, required): Longitude coordinate
  - `radius` (number): Search radius in meters (default: 5000)
  - `propertyType` (string|array): Filter by property type
  - `listingType` (string|array): Filter by listing type
  - `minPrice` (number): Minimum price filter
  - `maxPrice` (number): Maximum price filter
  - `limit` (number): Number of results (default: 20)
  - `sortBy` (string): Sort by 'distance', 'price', 'views', or 'createdAt'

#### Get Search Filters
- **GET** `/properties/search/filters`
- **Auth Required:** No
- **Description:** Get available search filters and their options
- **Response:** Available filter options with counts

#### Get Search Suggestions
- **GET** `/properties/search/suggestions`
- **Auth Required:** No
- **Description:** Get search suggestions based on query
- **Query Parameters:**
  - `query` (string, required): Search query (min 2 characters)
  - `type` (string): 'all', 'locations', 'properties', 'amenities'
  - `limit` (number): Number of suggestions (default: 10)

### 3. Property Photo Management

#### Upload Property Photos
- **POST** `/properties/:id/photos`
- **Auth Required:** Yes (Owner only)
- **Description:** Upload multiple photos for a property
- **Content-Type:** multipart/form-data
- **Body:** 
  - `photos` (files): Image files (max 10, 5MB each)
  - `captions` (array): Photo captions
  - `rooms` (array): Room names for each photo

#### Delete Property Photo
- **DELETE** `/properties/:id/photos/:photoId`
- **Auth Required:** Yes (Owner only)
- **Description:** Delete a specific photo

#### Set Primary Photo
- **POST** `/properties/:id/photos/:photoId/primary`
- **Auth Required:** Yes (Owner only)
- **Description:** Set a photo as the primary image

#### Reorder Photos
- **PUT** `/properties/:id/photos/reorder`
- **Auth Required:** Yes (Owner only)
- **Description:** Reorder property photos
- **Body:**
```json
{
  "photoOrder": ["photoId1", "photoId2", "photoId3"]
}
```

#### Update Photo Details
- **PUT** `/properties/:id/photos/:photoId`
- **Auth Required:** Yes (Owner only)
- **Description:** Update photo caption and room information
- **Body:**
```json
{
  "caption": "Beautiful living room",
  "room": "Living Room"
}
```

### 4. Property Favorites

#### Add to Favorites
- **POST** `/favorites`
- **Auth Required:** Yes
- **Description:** Add a property to user's favorites
- **Body:**
```json
{
  "propertyId": "property_id_here"
}
```

#### Remove from Favorites
- **DELETE** `/favorites/:propertyId`
- **Auth Required:** Yes
- **Description:** Remove a property from favorites

#### Get User Favorites
- **GET** `/favorites`
- **Auth Required:** Yes
- **Description:** Get user's favorite properties with pagination
- **Query Parameters:**
  - `page` (number): Page number
  - `limit` (number): Items per page
  - `sortBy` (string): Sort field
  - `sortOrder` (string): Sort order

#### Check Favorite Status
- **GET** `/favorites/:propertyId/status`
- **Auth Required:** Yes
- **Description:** Check if a property is in user's favorites

#### Get Favorites Count
- **GET** `/favorites/count`
- **Auth Required:** Yes
- **Description:** Get total count of user's favorites

### 5. Property Analytics

#### Get Property Analytics
- **GET** `/properties/:id/analytics`
- **Auth Required:** Yes (Owner only)
- **Description:** Get detailed analytics for a property
- **Response:** Views, favorites, inquiries, applications data

### 6. Owner Dashboard

#### Get Owner Properties
- **GET** `/properties/owner`
- **Auth Required:** Yes
- **Description:** Get all properties owned by the authenticated user
- **Query Parameters:**
  - `status` (string): Filter by property status
  - `page` (number): Page number
  - `limit` (number): Items per page

#### Get Property Suggestions
- **GET** `/properties/suggestions`
- **Auth Required:** Yes
- **Description:** Get personalized property suggestions based on user preferences

---

## Data Models

### Property Object Structure
```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "propertyType": "apartment|house|condo|studio|duplex|bungalow|mansion",
  "listingType": "rent|roommate|sublet",
  "ownerId": "string",
  "ownerType": "individual|agent|company",
  "bedrooms": "number",
  "bathrooms": "number",
  "totalRooms": "number",
  "floorArea": "number",
  "floor": "number",
  "totalFloors": "number",
  "yearBuilt": "number",
  "location": {
    "address": "string",
    "city": "string",
    "state": "string",
    "country": "Nigeria",
    "area": "string",
    "landmark": "string",
    "coordinates": {
      "type": "Point",
      "coordinates": [longitude, latitude]
    }
  },
  "pricing": {
    "rentPerMonth": "number",
    "securityDeposit": "number",
    "agentFee": "number",
    "legalFee": "number",
    "cautionFee": "number",
    "serviceCharge": "number",
    "electricityIncluded": "boolean",
    "waterIncluded": "boolean",
    "internetIncluded": "boolean",
    "paymentFrequency": "monthly|quarterly|biannually|annually",
    "advancePayment": "number"
  },
  "amenities": {
    "wifi": "boolean",
    "parking": "boolean",
    "security": "boolean",
    "generator": "boolean",
    "borehole": "boolean",
    "airConditioning": "boolean",
    "kitchen": "boolean",
    "refrigerator": "boolean",
    "microwave": "boolean",
    "gasStove": "boolean",
    "furnished": "boolean",
    "tv": "boolean",
    "washingMachine": "boolean",
    "elevator": "boolean",
    "gym": "boolean",
    "swimmingPool": "boolean",
    "playground": "boolean",
    "prepaidMeter": "boolean",
    "cableTV": "boolean",
    "cleaningService": "boolean"
  },
  "rules": {
    "smokingAllowed": "boolean",
    "petsAllowed": "boolean",
    "partiesAllowed": "boolean",
    "guestsAllowed": "boolean",
    "curfew": "string",
    "minimumStay": "number",
    "maximumOccupants": "number"
  },
  "photos": [
    {
      "id": "string",
      "url": "string",
      "publicId": "string",
      "caption": "string",
      "isPrimary": "boolean",
      "room": "string",
      "uploadedAt": "date"
    }
  ],
  "isAvailable": "boolean",
  "availableFrom": "date",
  "availableTo": "date",
  "roommatePreferences": {
    "gender": "male|female|any",
    "ageRange": {
      "min": "number",
      "max": "number"
    },
    "occupation": ["string"],
    "lifestyle": {
      "smoking": "boolean",
      "drinking": "boolean",
      "pets": "boolean",
      "parties": "boolean"
    }
  },
  "status": "draft|active|inactive|rented|suspended",
  "isVerified": "boolean",
  "verifiedAt": "date",
  "verifiedBy": "string",
  "analytics": {
    "views": "number",
    "favorites": "number",
    "inquiries": "number",
    "applications": "number",
    "lastViewedAt": "date",
    "averageViewDuration": "number"
  },
  "tags": ["string"],
  "searchKeywords": ["string"],
  "createdAt": "date",
  "updatedAt": "date",
  "lastModifiedBy": "string"
}
```

---

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "errors": "Detailed error information",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Success Responses

All endpoints return standardized success responses:

```json
{
  "success": true,
  "message": "Success message",
  "data": "Response data",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Nigerian States Supported

The API supports all 36 Nigerian states plus FCT:
- Abia, Adamawa, Akwa Ibom, Anambra, Bauchi, Bayelsa, Benue, Borno
- Cross River, Delta, Ebonyi, Edo, Ekiti, Enugu, FCT, Gombe
- Imo, Jigawa, Kaduna, Kano, Katsina, Kebbi, Kogi, Kwara
- Lagos, Nasarawa, Niger, Ogun, Ondo, Osun, Oyo, Plateau
- Rivers, Sokoto, Taraba, Yobe, Zamfara
