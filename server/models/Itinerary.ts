
import mongoose from 'mongoose';

const ItinerarySchema = new mongoose.Schema({
  id: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  email: {
    type: String,
    required: false,
    default: null
  },
  unlocked: { 
    type: Boolean, 
    default: false,
    required: true
  },
  // We store the exact JSON from the Gemini API here using Mixed type for flexibility
  plan: { 
    type: mongoose.Schema.Types.Mixed, 
    required: true 
  },
  // Store base64 images mapped by day number
  images: {
    type: Map,
    of: String,
    default: {}
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

export const Itinerary = mongoose.model('Itinerary', ItinerarySchema);
