import mongoose, { Schema } from 'mongoose';

export type Place = {
  displayName?: string;
  city?: string;
  locality?: string;
  road?: string;
  neighbourhood?: string;
  postcode?: string;
  country?: string;
};

export type LocationPingDoc = {
  deviceId: string;
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp: Date;
  place?: Place;
  userAgent?: string;
  platform?: string;
  createdAt: Date;
};

const PlaceSchema = new Schema<Place>(
  {
    displayName: { type: String },
    city: { type: String },
    locality: { type: String },
    road: { type: String },
    neighbourhood: { type: String },
    postcode: { type: String },
    country: { type: String }
  },
  { _id: false }
);

const LocationPingSchema = new Schema<LocationPingDoc>(
  {
    deviceId: { type: String, required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    accuracy: { type: Number },
    timestamp: { type: Date, required: true, index: true },
    place: { type: PlaceSchema },
    userAgent: { type: String },
    platform: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LocationPingSchema.index({ createdAt: 1 });

export const LocationPing =
  (mongoose.models.LocationPing as mongoose.Model<LocationPingDoc>) ||
  mongoose.model<LocationPingDoc>('LocationPing', LocationPingSchema);
