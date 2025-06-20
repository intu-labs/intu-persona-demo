import mongoose, { Schema, Document } from 'mongoose';

export interface IExpertise extends Document {
  title: string;
  content: string;
  tags: string[];
  links: { label: string; url: string }[];
  createdAt: Date;
  updatedAt: Date;
}

const ExpertiseSchema = new Schema<IExpertise>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  tags: { type: [String], default: [] },
  links: [{ label: String, url: String }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ExpertiseSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IExpertise>('Expertise', ExpertiseSchema); 