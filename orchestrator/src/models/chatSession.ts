import mongoose, { Schema, Document } from "mongoose";

// Message interface
export interface IMessage extends Document {
  role: string;
  content: string;
  timestamp: Date;
}

// Chat session interface
export interface IChatSession extends Document {
  sessionId: string;
  createDate: Date;
  updateDate: Date;
  messages: IMessage[];
  metadata: Record<string, any>;
}

// Message schema
const MessageSchema = new Schema<IMessage>({
  role: { type: String, required: true, enum: ["user", "assistant", "system"] },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Chat session schema
const ChatSessionSchema = new Schema<IChatSession>({
  sessionId: { type: String, required: true, unique: true, index: true },
  createDate: { type: Date, default: Date.now },
  updateDate: { type: Date, default: Date.now },
  messages: [MessageSchema],
  metadata: { type: Schema.Types.Mixed, default: {} },
});

// Update the updateDate field on every save
ChatSessionSchema.pre("save", function (next) {
  this.updateDate = new Date();
  next();
});

// Create and export the model
export default mongoose.model<IChatSession>("ChatSession", ChatSessionSchema);
