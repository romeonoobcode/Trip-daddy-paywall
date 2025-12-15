
import { UserPreferences, SmartQuestion, Itinerary, Activity, DayPlan } from "../types";

const API_BASE = 'http://localhost:3001/api';

export const validateDestination = async (destination: string): Promise<{ isValid: boolean, formattedName?: string }> => {
  try {
    const res = await fetch(`${API_BASE}/validate-destination`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination })
    });
    return await res.json();
  } catch (error) {
    return { isValid: true, formattedName: destination };
  }
};

export const checkEventsAndGetQuestions = async (prefs: UserPreferences): Promise<SmartQuestion[]> => {
  try {
    const res = await fetch(`${API_BASE}/check-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs })
    });
    return await res.json();
  } catch (error) {
    return [];
  }
};

export const generateItinerary = async (prefs: UserPreferences): Promise<{ id: string, plan: Itinerary, unlocked: boolean, totalDays: number, images: Record<number, string> } | null> => {
  try {
    const res = await fetch(`${API_BASE}/generate-trip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefs })
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn("Generation failed", e);
    return null;
  }
};

export const getItineraryById = async (id: string): Promise<{ id: string, plan: Itinerary, unlocked: boolean, totalDays: number, images: Record<number, string> } | null> => {
    try {
        const res = await fetch(`${API_BASE}/itinerary/${id}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
};

export const saveUserEmail = async (email: string, itineraryId: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/save-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, itineraryId })
        });
        return res.ok;
    } catch (e) {
        return false;
    }
};

export const createCheckoutSession = async (itineraryId: string): Promise<string | null> => {
    try {
        const res = await fetch(`${API_BASE}/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itineraryId })
        });
        const data = await res.json();
        return data.url || null;
    } catch (e) {
        console.error("Payment session failed", e);
        return null;
    }
};

export const verifyPayment = async (itineraryId: string, sessionId: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/verify-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itineraryId, sessionId })
        });
        const data = await res.json();
        return data.success === true;
    } catch (e) {
        console.error("Verification failed", e);
        return false;
    }
};

// Deprecated in favor of saveUserEmail, but kept for legacy specific manual shares
export const shareItinerary = async (email: string, itineraryId: string): Promise<boolean> => {
    return saveUserEmail(email, itineraryId);
};

export const getAlternativeActivity = async (
  prefs: UserPreferences, 
  currentActivity: Activity, 
  context: { dayTitle: string, area: string, timeOfDay: string },
  existingActivityNames: string[] = [],
  customRequest?: string
): Promise<Activity | null> => {
  try {
    const res = await fetch(`${API_BASE}/alternative-activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            prefs, currentActivity, context, existingNames: existingActivityNames, customRequest 
        })
    });
    return await res.json();
  } catch (e) {
    return null;
  }
}

export const generateDayCardImage = async (dayTitle: string, area: string, destination: string, vibe: string): Promise<string | null> => {
    try {
        const res = await fetch(`${API_BASE}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dayTitle, area, destination, vibe })
        });
        const data = await res.json();
        return data.image;
    } catch (e) {
        return null;
    }
}

export const saveGeneratedImage = async (itineraryId: string, dayNumber: number, image: string): Promise<boolean> => {
    try {
        const res = await fetch(`${API_BASE}/save-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itineraryId, dayNumber, image })
        });
        return res.ok;
    } catch (e) {
        return false;
    }
}
