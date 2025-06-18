import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPropertyFavorite extends Document {
  userId: Types.ObjectId;
  propertyId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PropertyFavoriteSchema = new Schema<IPropertyFavorite>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  propertyId: {
    type: Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound index to ensure unique user-property combinations
PropertyFavoriteSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

// Index for efficient queries
PropertyFavoriteSchema.index({ userId: 1, createdAt: -1 });
PropertyFavoriteSchema.index({ propertyId: 1, createdAt: -1 });

export const PropertyFavorite = mongoose.model<IPropertyFavorite>('PropertyFavorite', PropertyFavoriteSchema);
