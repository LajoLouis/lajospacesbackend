# 🧪 Manual Testing Commands for User Management

## 🔧 **Prerequisites**
- Server running on `http://localhost:3001`
- Test users created (use authentication tests first)
- Valid access tokens for protected endpoints

---

## 📋 **Profile Management Tests**

### **1. Get Profile (Protected)**
```bash
curl -X GET http://localhost:3001/api/profiles/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **2. Update Profile (Protected)**
```bash
curl -X PATCH http://localhost:3001/api/profiles/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "bio": "Updated bio - I am a passionate developer",
    "occupation": "Senior Software Engineer",
    "education": "Computer Science, University of Lagos",
    "languages": ["English", "Yoruba", "French"],
    "interests": ["coding", "hiking", "photography"],
    "hobbies": ["guitar", "reading", "cycling"],
    "lifestyle": {
      "smokingPolicy": "no-smoking",
      "drinkingPolicy": "social-drinking",
      "petPolicy": "cats-only",
      "cleanlinessLevel": "very-clean"
    }
  }'
```

### **3. Get Public Profile**
```bash
curl -X GET http://localhost:3001/api/profiles/USER_ID_HERE
```

### **4. Update Privacy Settings (Protected)**
```bash
curl -X PATCH http://localhost:3001/api/profiles/privacy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "privacy": {
      "showFullName": true,
      "showAge": true,
      "showLocation": true,
      "showOccupation": true,
      "showSocialMedia": false,
      "allowMessagesFromUnmatched": false
    }
  }'
```

### **5. Get Profile Completion (Protected)**
```bash
curl -X GET http://localhost:3001/api/profiles/completion \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 📸 **Photo Management Tests**

### **1. Get Photo Guidelines (Public)**
```bash
curl -X GET http://localhost:3001/api/photos/guidelines
```

### **2. Get User Photos (Protected)**
```bash
curl -X GET http://localhost:3001/api/photos/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **3. Upload Photo (Protected) - Multipart**
```bash
curl -X POST http://localhost:3001/api/photos/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "photo=@/path/to/your/image.jpg"
```

### **4. Set Primary Photo (Protected)**
```bash
curl -X PATCH http://localhost:3001/api/photos/PHOTO_ID/primary \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **5. Delete Photo (Protected)**
```bash
curl -X DELETE http://localhost:3001/api/photos/PHOTO_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **6. Reorder Photos (Protected)**
```bash
curl -X PATCH http://localhost:3001/api/photos/reorder \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "photoOrder": ["photo_id_1", "photo_id_2", "photo_id_3"]
  }'
```

---

## 🔍 **Search System Tests**

### **1. Basic User Search (Public)**
```bash
curl -X GET "http://localhost:3001/api/search/users?limit=5"
```

### **2. Search with Account Type Filter**
```bash
curl -X GET "http://localhost:3001/api/search/users?accountType=seeker&limit=10"
```

### **3. Search with Multiple Filters**
```bash
curl -X GET "http://localhost:3001/api/search/users?accountType=seeker&gender=male&ageMin=20&ageMax=35&limit=10"
```

### **4. Search with Location Filter**
```bash
curl -X GET "http://localhost:3001/api/search/users?location=Lagos&limit=10"
```

### **5. Search with Budget Filter**
```bash
curl -X GET "http://localhost:3001/api/search/users?budgetMin=50000&budgetMax=200000&limit=10"
```

### **6. Search with Lifestyle Filters**
```bash
curl -X GET "http://localhost:3001/api/search/users?smokingPolicy=no-smoking&petPolicy=cats-only&limit=10"
```

### **7. Text Search**
```bash
curl -X GET "http://localhost:3001/api/search/users?search=John&limit=10"
```

### **8. Search with Pagination**
```bash
curl -X GET "http://localhost:3001/api/search/users?page=2&limit=5"
```

### **9. Search with Sorting**
```bash
curl -X GET "http://localhost:3001/api/search/users?sortBy=lastActiveAt&sortOrder=desc&limit=10"
```

---

## 💡 **Search Suggestions & Analytics**

### **1. Location Suggestions**
```bash
curl -X GET "http://localhost:3001/api/search/suggestions?query=lag&type=locations"
```

### **2. Interest Suggestions**
```bash
curl -X GET "http://localhost:3001/api/search/suggestions?query=cod&type=interests"
```

### **3. Occupation Suggestions**
```bash
curl -X GET "http://localhost:3001/api/search/suggestions?query=eng&type=occupations"
```

### **4. All Suggestions**
```bash
curl -X GET "http://localhost:3001/api/search/suggestions?query=tech&type=all"
```

### **5. Popular Filters**
```bash
curl -X GET http://localhost:3001/api/search/popular-filters
```

---

## ❌ **Validation Testing**

### **1. Invalid Profile Update**
```bash
curl -X PATCH http://localhost:3001/api/profiles/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "bio": "x",
    "occupation": "",
    "languages": ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"],
    "lifestyle": {
      "smokingPolicy": "invalid-option"
    }
  }'
```

### **2. Invalid Privacy Settings**
```bash
curl -X PATCH http://localhost:3001/api/profiles/privacy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "privacy": {
      "showFullName": "not-a-boolean",
      "invalidField": true
    }
  }'
```

### **3. Invalid User ID**
```bash
curl -X GET http://localhost:3001/api/profiles/invalid-user-id
```

---

## 🔐 **Authentication Testing**

### **1. Unauthorized Profile Access**
```bash
curl -X GET http://localhost:3001/api/profiles/
```

### **2. Invalid Token**
```bash
curl -X GET http://localhost:3001/api/profiles/ \
  -H "Authorization: Bearer invalid_token"
```

### **3. Expired Token**
```bash
curl -X GET http://localhost:3001/api/profiles/ \
  -H "Authorization: Bearer expired_token_here"
```

---

## 📊 **Performance Testing**

### **1. Large Search Query**
```bash
curl -X GET "http://localhost:3001/api/search/users?limit=50&page=1"
```

### **2. Complex Filter Combination**
```bash
curl -X GET "http://localhost:3001/api/search/users?accountType=seeker&gender=male&ageMin=20&ageMax=35&location=Lagos&budgetMin=50000&budgetMax=200000&smokingPolicy=no-smoking&petPolicy=cats-only&interests=coding&occupation=engineer&limit=20"
```

---

## 🎯 **Health Checks**

### **1. All Health Endpoints**
```bash
# Main API
curl -X GET http://localhost:3001/health

# Authentication
curl -X GET http://localhost:3001/api/auth/health

# Profiles
curl -X GET http://localhost:3001/api/profiles/health

# Photos
curl -X GET http://localhost:3001/api/photos/health

# Search
curl -X GET http://localhost:3001/api/search/health
```

---

## 📝 **Notes for Testing**

### **Getting Access Tokens**
1. Register a user: `POST /api/auth/register`
2. Login: `POST /api/auth/login`
3. Use the `accessToken` from the response

### **Test User IDs**
- Use the user IDs from the seeded data or registration responses
- Check the database or registration responses for valid user IDs

### **Photo Upload Testing**
- Use actual image files (JPEG, PNG, WebP)
- Max file size: 10MB
- Test with different image sizes and formats

### **Expected Response Codes**
- ✅ **200**: Successful GET/PATCH requests
- ✅ **201**: Successful POST requests (photo upload)
- ❌ **400**: Validation errors
- ❌ **401**: Authentication required
- ❌ **403**: Forbidden (privacy restrictions)
- ❌ **404**: Resource not found
- ❌ **500**: Server errors

---

## 🚀 **Quick Test Sequence**

### **Complete User Journey Test**
```bash
# 1. Register user
curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"TestPass123!","firstName":"Test","lastName":"User","dateOfBirth":"1995-01-01","gender":"male","accountType":"seeker","agreeToTerms":true}'

# 2. Login and get token
curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"TestPass123!"}'

# 3. Get profile (use token from step 2)
curl -X GET http://localhost:3001/api/profiles/ -H "Authorization: Bearer YOUR_TOKEN"

# 4. Update profile
curl -X PATCH http://localhost:3001/api/profiles/ -H "Content-Type: application/json" -H "Authorization: Bearer YOUR_TOKEN" -d '{"bio":"Updated bio","occupation":"Developer"}'

# 5. Search users
curl -X GET "http://localhost:3001/api/search/users?limit=5"

# 6. Get profile completion
curl -X GET http://localhost:3001/api/profiles/completion -H "Authorization: Bearer YOUR_TOKEN"
```

This completes the comprehensive manual testing guide! 🎉
