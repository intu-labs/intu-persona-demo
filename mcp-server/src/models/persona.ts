import mongoose, { Schema, Document } from 'mongoose';

export interface IPersona extends Document {
  name: string;
  gender: string;
  confidence: number;
  sarcasm: number;
  charm: number;
  morality: number;
  appearance: string;
  region: string;
  education: number;
  accessory: string;
  systemPrompt: string;
  type: string; // 'neutral' | 'example'
  createdAt: Date;
  updatedAt: Date;
}

const PersonaSchema = new Schema<IPersona>({
  name: { type: String, required: true },
  gender: { type: String, required: true },
  confidence: { type: Number, required: true },
  sarcasm: { type: Number, required: true },
  charm: { type: Number, required: true },
  morality: { type: Number, required: true },
  appearance: { type: String, required: true },
  region: { type: String, required: true },
  education: { type: Number, required: true },
  accessory: { type: String, required: true },
  systemPrompt: { type: String, required: true },
  type: { type: String, required: true, enum: ['neutral', 'example'] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PersonaSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export default mongoose.model<IPersona>('Persona', PersonaSchema); 