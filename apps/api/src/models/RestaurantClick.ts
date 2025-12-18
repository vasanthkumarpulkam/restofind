import mongoose, { Schema } from 'mongoose';

export type RestaurantClickDoc = {
  deviceId: string;
  restaurantId: string;
  name: string;
  cuisine?: string;
  timestamp: Date;
  createdAt: Date;
};

const RestaurantClickSchema = new Schema<RestaurantClickDoc>(
  {
    deviceId: { type: String, required: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    cuisine: { type: String },
    timestamp: { type: Date, required: true, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

RestaurantClickSchema.index({ createdAt: 1 });

export const RestaurantClick =
  (mongoose.models.RestaurantClick as mongoose.Model<RestaurantClickDoc>) ||
  mongoose.model<RestaurantClickDoc>('RestaurantClick', RestaurantClickSchema);
