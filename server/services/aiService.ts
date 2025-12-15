
import { GoogleGenAI } from "@google/genai";
import dotenv from 'dotenv';

dotenv.config();

// We redefine minimal types here to avoid complex monorepo setup issues in this environment
interface UserPreferences {
  destination: string;
  startDate: string;
  endDate: string;
  hotelLocation: string;
  tripType: string;
  budget: string;
  vibe: string;
  pace: string;
  interests: string[];
  demographics: any;
  fixedPlans: any[];
  mustVisit: string;
  followUpAnswers: Record<string, boolean>;
}

const getApiKey = (): string => {
  return process.env.API_KEY || "";
};

// Helper to extract JSON
function extractJSON(text: string): any {
  try {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      return JSON.parse(jsonMatch[1]);
    }
    const firstOpenBrace = text.indexOf('{');
    const firstOpenBracket = text.indexOf('[');
    let startIndex = -1;
    let endIndex = -1;
    if (firstOpenBrace !== -1 && (firstOpenBracket === -1 || firstOpenBrace < firstOpenBracket)) {
        startIndex = firstOpenBrace;
        endIndex = text.lastIndexOf('}');
    } else if (firstOpenBracket !== -1) {
        startIndex = firstOpenBracket;
        endIndex = text.lastIndexOf(']');
    }
    if (startIndex !== -1 && endIndex !== -1) {
        return JSON.parse(text.substring(startIndex, endIndex + 1));
    }
    return JSON.parse(text);
  } catch (e) {
    console.warn("JSON Extraction Failed:", e);
    return null;
  }
}

function formatDateForPrompt(isoDate: string): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

export const validateDestination = async (destination: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = "gemini-2.5-flash";
  const prompt = `Analyze destination: "${destination}". Return JSON: { "isValid": boolean, "formattedName": string | null }. If valid, provide "City, Country".`;
  
  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    return extractJSON(response.text || "{}");
  } catch (error) {
    console.error("Validation error", error);
    return { isValid: true, formattedName: destination };
  }
};

export const checkEventsAndGetQuestions = async (prefs: UserPreferences) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = "gemini-2.5-flash";
  
  const startDate = formatDateForPrompt(prefs.startDate);
  const endDate = formatDateForPrompt(prefs.endDate);
  const start = new Date(prefs.startDate);
  const end = new Date(prefs.endDate);
  const durationDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const targetNumQuestions = durationDays <= 5 ? 5 : 10;

  const prompt = `
    Context: Trip to ${prefs.destination}, ${startDate}-${endDate} (${durationDays} days).
    Who: ${prefs.tripType}. Interests: ${prefs.interests.join(', ')}.
    TASK: Generate exactly ${targetNumQuestions} "Tinder-style" Yes/No questions.
    STRATEGY: Check events, ask unique activity questions.
    Return JSON array: [{ "id": "snake_case_id", "emoji": "SingleChar", "title": "Title", "description": "Short question?" }]
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    const res = extractJSON(response.text || "[]");
    return Array.isArray(res) ? res.slice(0, targetNumQuestions) : [];
  } catch (error) {
    return [];
  }
};

const optimizeItineraryRoute = async (initialItinerary: any, prefs: UserPreferences) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const model = "gemini-2.5-flash";

    const rejectedActivities = Object.entries(prefs.followUpAnswers)
        .filter(([_, liked]) => !liked)
        .map(([id]) => id.replace(/_/g, ' '))
        .join(", ");

    const prompt = `
    Act as a Master Travel Logistician. Review itinerary for ${prefs.destination}.
    CURRENT ITINERARY JSON: ${JSON.stringify(initialItinerary)}
    CONSTRAINTS: Remove rejected items: ${rejectedActivities}.
    MISSION: 
    1. Add "latitude" and "longitude" to every activity.
    2. Cluster activities geographically (no zig-zag).
    3. Ensure SPECIFIC NAMES for places.
    4. Ensure Price vs Admission logic is correct.
    Return OPTIMIZED JSON only.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { 
                tools: [{ googleMaps: {} }],
                responseMimeType: "application/json" 
            }
        });
        const optimized = extractJSON(response.text || "{}");
        return (optimized && optimized.days) ? optimized : initialItinerary;
    } catch (e) {
        return initialItinerary;
    }
};

export const generateItinerary = async (prefs: UserPreferences) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = "gemini-2.5-flash";
  
  const startDate = formatDateForPrompt(prefs.startDate);
  const endDate = formatDateForPrompt(prefs.endDate);
  
  const rejectedItems = Object.entries(prefs.followUpAnswers)
    .filter(([_, liked]) => !liked)
    .map(([id]) => id.replace(/_/g, ' '))
    .join(", ");

  const prompt = `
    Create JSON itinerary for ${prefs.destination}, ${startDate} to ${endDate}.
    Who: ${prefs.tripType}. Budget: ${prefs.budget}. Vibe: ${prefs.vibe}.
    User Banned: [ ${rejectedItems} ].
    Interests: ${prefs.interests.join(', ')}.
    Include Fixed Plans: ${JSON.stringify(prefs.fixedPlans)}.
    
    Structure:
    {
      "destination": "${prefs.destination}",
      "days": [{
          "dayNumber": 1, "date": "DD/MM/YYYY", "areaFocus": "...", "title": "...", "vibe": "...", "vibeIcons": ["x"],
          "highlightEvent": { "name": "...", "description": "...", "mapsQuery": "..." },
          "morning": [{ "name": "...", "description": "...", "emoji": "x", "category": "...", "type": "...", "mapsQuery": "...", "priceLevel": "$$", "admissionFee": "$20", "rating": 4.5, "openingHours": "..." }],
          "afternoon": [], "evening": []
      }]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { tools: [{ googleMaps: {} }] }
    });

    const draft = extractJSON(response.text || "{}");
    if (draft && Array.isArray(draft.days)) {
        return await optimizeItineraryRoute(draft, prefs);
    }
    return null;
  } catch (e) {
    console.error("Generate Itinerary Error", e);
    return null;
  }
};

export const getAlternativeActivity = async (prefs: UserPreferences, currentActivity: any, context: any, existingNames: string[], customRequest: string) => {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });
  const model = "gemini-2.5-flash";

  const prompt = `
    Suggest ALTERNATIVE activity for: "${currentActivity.name}" in ${prefs.destination}.
    Context: ${context.timeOfDay}, ${context.area}. Custom Request: ${customRequest}.
    Constraint: Real place, specific name, open now.
    Return JSON (Activity Object).
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] }
    });
    return extractJSON(response.text || "null");
  } catch (e) {
    return null;
  }
};

export const generateDayCardImage = async (dayTitle: string, area: string, destination: string, vibe: string) => {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    const model = 'gemini-3-pro-image-preview';
    
    const prompt = `
      Travel illustration for ${destination}, ${area}. Mood: ${vibe}, ${dayTitle}.
      Style: Flat vector art, pastel colors. NO TEXT. 16:9.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { imageConfig: { aspectRatio: "16:9", imageSize: "1K" } }
        });
        
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
        }
        return null;
    } catch (e) {
        return null;
    }
};
