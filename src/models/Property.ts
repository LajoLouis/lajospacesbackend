import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProperty extends Document {
  title: string;
  description: string;
  propertyType: 'apartment' | 'house' | 'condo' | 'studio' | 'duplex' | 'bungalow' | 'mansion';
  listingType: 'rent' | 'roommate' | 'sublet';
  ownerId: Types.ObjectId;
  ownerType: 'individual' | 'agent' | 'company';
  bedrooms: number;
  bathrooms: number;
  totalRooms: number;
  floorArea?: number;
  floor?: number;
  totalFloors?: number;
  yearBuilt?: number;
  location: {
    address: string;
    city: string;
    state: string;
    country: string;
    area?: string;
    landmark?: string;
    coordinates: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  pricing: {
    rentPerMonth: number;
    securityDeposit: number;
    agentFee?: number;
    legalFee?: number;
    cautionFee?: number;
    serviceCharge?: number;
    electricityIncluded: boolean;
    waterIncluded: boolean;
    internetIncluded: boolean;
    paymentFrequency: 'monthly' | 'quarterly' | 'biannually' | 'annually';
    advancePayment: number;
  };
  amenities: {
    wifi: boolean;
    parking: boolean;
    security: boolean;
    generator: boolean;
    borehole: boolean;
    airConditioning: boolean;
    kitchen: boolean;
    refrigerator: boolean;
    microwave: boolean;
    gasStove: boolean;
    furnished: boolean;
    tv: boolean;
    washingMachine: boolean;
    elevator: boolean;
    gym: boolean;
    swimmingPool: boolean;
    playground: boolean;
    prepaidMeter: boolean;
    cableTV: boolean;
    cleaningService: boolean;
  };
  rules: {
    smokingAllowed: boolean;
    petsAllowed: boolean;
    partiesAllowed: boolean;
    guestsAllowed: boolean;
    curfew?: string;
    minimumStay?: number;
    maximumOccupants: number;
  };
  photos: Array<{
    id: string;
    url: string;
    publicId: string;
    caption?: string;
    isPrimary: boolean;
    room?: string;
    uploadedAt: Date;
  }>;
  isAvailable: boolean;
  availableFrom: Date;
  availableTo?: Date;
  roommatePreferences?: {
    gender: 'male' | 'female' | 'any';
    ageRange: { min: number; max: number };
    occupation: string[];
    lifestyle: {
      smoking: boolean;
      drinking: boolean;
      pets: boolean;
      parties: boolean;
    };
  };
  status: 'draft' | 'active' | 'inactive' | 'rented' | 'suspended';
  isVerified: boolean;
  verifiedAt?: Date;
  verifiedBy?: Types.ObjectId;
  analytics: {
    views: number;
    favorites: number;
    inquiries: number;
    applications: number;
    lastViewedAt?: Date;
    averageViewDuration?: number;
  };
  tags: string[];
  searchKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
  lastModifiedBy: Types.ObjectId;
  incrementViews(): Promise<IProperty>;
  isAffordable(maxBudget: number): boolean;
}

// Add static methods interface
interface IPropertyModel extends mongoose.Model<IProperty> {
  findWithinBudget(minBudget: number, maxBudget: number): mongoose.Query<IProperty[], IProperty>;
  findNearby(longitude: number, latitude: number, maxDistance?: number): mongoose.Query<IProperty[], IProperty>;
}

const PropertySchema = new Schema<IProperty>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  propertyType: {
    type: String,
    required: true,
    enum: ['apartment', 'house', 'condo', 'studio', 'duplex', 'bungalow', 'mansion'],
    index: true
  },
  listingType: {
    type: String,
    required: true,
    enum: ['rent', 'roommate', 'sublet'],
    index: true
  },
  ownerId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  ownerType: {
    type: String,
    required: true,
    enum: ['individual', 'agent', 'company'],
    default: 'individual'
  },
  bedrooms: {
    type: Number,
    required: true,
    min: 0,
    max: 20,
    index: true
  },
  bathrooms: {
    type: Number,
    required: true,
    min: 1,
    max: 20,
    index: true
  },
  totalRooms: {
    type: Number,
    required: true,
    min: 1,
    max: 50
  },
  floorArea: {
    type: Number,
    min: 10,
    max: 10000
  },
  floor: {
    type: Number,
    min: 0,
    max: 100
  },
  totalFloors: {
    type: Number,
    min: 1,
    max: 100
  },
  yearBuilt: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 5
  },
  location: {
    address: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    state: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true
    },
    country: {
      type: String,
      required: true,
      default: 'Nigeria',
      index: true
    },
    area: {
      type: String,
      trim: true,
      maxlength: 100,
      index: true
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: 200
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        required: true
      },
      coordinates: {
        type: [Number],
        required: true,
        index: '2dsphere'
      }
    }
  },
  pricing: {
    rentPerMonth: {
      type: Number,
      required: true,
      min: 1000,
      max: 10000000,
      index: true
    },
    securityDeposit: {
      type: Number,
      required: true,
      min: 0
    },
    agentFee: {
      type: Number,
      min: 0,
      default: 0
    },
    legalFee: {
      type: Number,
      min: 0,
      default: 0
    },
    cautionFee: {
      type: Number,
      min: 0,
      default: 0
    },
    serviceCharge: {
      type: Number,
      min: 0,
      default: 0
    },
    electricityIncluded: {
      type: Boolean,
      default: false
    },
    waterIncluded: {
      type: Boolean,
      default: false
    },
    internetIncluded: {
      type: Boolean,
      default: false
    },
    paymentFrequency: {
      type: String,
      enum: ['monthly', 'quarterly', 'biannually', 'annually'],
      default: 'annually'
    },
    advancePayment: {
      type: Number,
      min: 1,
      max: 24,
      default: 12
    }
  },
  amenities: {
    wifi: { type: Boolean, default: false },
    parking: { type: Boolean, default: false },
    security: { type: Boolean, default: false },
    generator: { type: Boolean, default: false },
    borehole: { type: Boolean, default: false },
    airConditioning: { type: Boolean, default: false },
    kitchen: { type: Boolean, default: true },
    refrigerator: { type: Boolean, default: false },
    microwave: { type: Boolean, default: false },
    gasStove: { type: Boolean, default: false },
    furnished: { type: Boolean, default: false },
    tv: { type: Boolean, default: false },
    washingMachine: { type: Boolean, default: false },
    elevator: { type: Boolean, default: false },
    gym: { type: Boolean, default: false },
    swimmingPool: { type: Boolean, default: false },
    playground: { type: Boolean, default: false },
    prepaidMeter: { type: Boolean, default: false },
    cableTV: { type: Boolean, default: false },
    cleaningService: { type: Boolean, default: false }
  },
  rules: {
    smokingAllowed: { type: Boolean, default: false },
    petsAllowed: { type: Boolean, default: false },
    partiesAllowed: { type: Boolean, default: false },
    guestsAllowed: { type: Boolean, default: true },
    curfew: { type: String, trim: true },
    minimumStay: { type: Number, min: 1, max: 24 },
    maximumOccupants: { type: Number, required: true, min: 1, max: 20 }
  },
  photos: [{
    id: { type: String, required: true },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    caption: { type: String, trim: true, maxlength: 200 },
    isPrimary: { type: Boolean, default: false },
    room: { type: String, trim: true, maxlength: 50 },
    uploadedAt: { type: Date, default: Date.now }
  }],
  isAvailable: {
    type: Boolean,
    default: true,
    index: true
  },
  availableFrom: {
    type: Date,
    required: true,
    index: true
  },
  availableTo: {
    type: Date,
    index: true
  },
  roommatePreferences: {
    gender: {
      type: String,
      enum: ['male', 'female', 'any'],
      default: 'any'
    },
    ageRange: {
      min: { type: Number, min: 18, max: 100, default: 18 },
      max: { type: Number, min: 18, max: 100, default: 65 }
    },
    occupation: [{ type: String, trim: true }],
    lifestyle: {
      smoking: { type: Boolean, default: false },
      drinking: { type: Boolean, default: false },
      pets: { type: Boolean, default: false },
      parties: { type: Boolean, default: false }
    }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'rented', 'suspended'],
    default: 'draft',
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  analytics: {
    views: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 },
    applications: { type: Number, default: 0 },
    lastViewedAt: { type: Date },
    averageViewDuration: { type: Number, default: 0 }
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  }],
  searchKeywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  lastModifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
PropertySchema.index({ 'location.coordinates': '2dsphere' });
PropertySchema.index({ 'location.city': 1, 'location.state': 1 });
PropertySchema.index({ 'pricing.rentPerMonth': 1 });
PropertySchema.index({ propertyType: 1, listingType: 1 });
PropertySchema.index({ status: 1, isAvailable: 1 });
PropertySchema.index({ ownerId: 1, status: 1 });
PropertySchema.index({ createdAt: -1 });
PropertySchema.index({ 'analytics.views': -1 });

// Text search index
PropertySchema.index({
  title: 'text',
  description: 'text',
  'location.address': 'text',
  'location.area': 'text',
  tags: 'text',
  searchKeywords: 'text'
});

// Virtual for total monthly cost
PropertySchema.virtual('totalMonthlyCost').get(function() {
  return this.pricing.rentPerMonth + (this.pricing.serviceCharge || 0);
});

// Virtual for property age
PropertySchema.virtual('propertyAge').get(function() {
  if (!this.yearBuilt) return null;
  return new Date().getFullYear() - this.yearBuilt;
});

// Virtual for photos count
PropertySchema.virtual('photoCount').get(function() {
  return this.photos.length;
});

// Virtual for primary photo
PropertySchema.virtual('primaryPhoto').get(function() {
  return this.photos.find(photo => photo.isPrimary) || this.photos[0] || null;
});

// Pre-save middleware to generate search keywords
PropertySchema.pre('save', function(next) {
  if (this.isModified('title') || this.isModified('description') || this.isModified('location')) {
    const keywords = new Set<string>();

    // Add title words
    this.title.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });

    // Add location keywords
    if (this.location.city) keywords.add(this.location.city.toLowerCase());
    if (this.location.state) keywords.add(this.location.state.toLowerCase());
    if (this.location.area) keywords.add(this.location.area.toLowerCase());

    // Add property type
    keywords.add(this.propertyType);
    keywords.add(this.listingType);

    // Add bedroom/bathroom info
    keywords.add(`${this.bedrooms}bedroom`);
    keywords.add(`${this.bathrooms}bathroom`);

    this.searchKeywords = Array.from(keywords);
  }

  next();
});

// Method to increment view count
PropertySchema.methods.incrementViews = function() {
  this.analytics.views += 1;
  this.analytics.lastViewedAt = new Date();
  return this.save();
};

// Method to check if property is affordable for a budget
PropertySchema.methods.isAffordable = function(maxBudget: number): boolean {
  return this.totalMonthlyCost <= maxBudget;
};

// Static method to find properties within budget
PropertySchema.statics.findWithinBudget = function(minBudget: number, maxBudget: number) {
  return this.find({
    'pricing.rentPerMonth': { $gte: minBudget, $lte: maxBudget },
    status: 'active',
    isAvailable: true
  });
};

// Static method for geospatial search
PropertySchema.statics.findNearby = function(longitude: number, latitude: number, maxDistance: number = 5000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance // in meters
      }
    },
    status: 'active',
    isAvailable: true
  });
};

export const Property = mongoose.model<IProperty, IPropertyModel>('Property', PropertySchema);