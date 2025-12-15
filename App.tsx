
import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Calendar, Hotel, Users, DollarSign, Clock, 
  Utensils, Moon, Landmark, Camera, Mountain, ShoppingBag, 
  Sparkles, Leaf, ArrowRight, Check, X, Plane, Loader2,
  Map, ExternalLink, Image as ImageIcon, ChevronRight, Key,
  Zap, Coffee, Scale, Plus, Trash2, Pin, Star, Ticket, Globe, Search,
  RotateCw, AlertCircle, ThumbsUp, ThumbsDown, ChevronLeft, Flag, MoreVertical, Info,
  Activity as ActivityIcon, User, Rabbit, Eye, Award, TrendingUp, ChefHat, Lock, CreditCard, Share2, Mail
} from 'lucide-react';
import { Button } from './components/Button';
import { Input } from './components/Input';
import { SelectableCard } from './components/SelectableCard';
import { DateRangePicker } from './components/DateRangePicker';
import { SingleDatePicker } from './components/SingleDatePicker';
import { RegenerateModal } from './components/RegenerateModal';
import { checkEventsAndGetQuestions, generateItinerary, generateDayCardImage, validateDestination, getAlternativeActivity, getItineraryById, createCheckoutSession, verifyPayment, saveUserEmail, saveGeneratedImage } from './services/geminiService';
import { UserPreferences, SmartQuestion, Itinerary, DayPlan, TripType, BudgetLevel, VibeType, PaceType, Interest, Activity, FixedPlan, Gender, KidsAgeRange } from './types';

// Step Enum
enum Step {
  START = 0,
  PREFERENCES = 1,
  SPECIFICS = 2,
  QUESTIONS = 3,
  LOADING = 4,
  ITINERARY = 5,
  VERIFYING_PAYMENT = 6, // New step for better UX
}

// Helper to construct Google Maps Search URL
const getGoogleMapsUrl = (query: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

// Helper to construct Google Search URL
const getGoogleSearchUrl = (query: string) => {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
};

// Helper to format date to DD/MM/YYYY
const formatDate = (isoDate: string) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

interface ActivityCardProps {
    activity: Activity;
    onDetailsClick: () => void;
    onRegenerate: () => void;
    onDelete: () => void;
    isRegenerating: boolean;
}

const ActivityCard: React.FC<ActivityCardProps> = ({ activity, onDetailsClick, onRegenerate, onDelete, isRegenerating }) => {
    return (
        <div className="group relative flex gap-4 bg-white p-4 rounded-2xl border border-slate-100 hover:border-sky-200 hover:shadow-md transition-all cursor-pointer" onClick={onDetailsClick}>
             <div className="flex-shrink-0 w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-2xl shadow-sm">
                {activity.emoji}
             </div>
             
             <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-start">
                    <h5 className="font-bold text-slate-900 truncate pr-2">{activity.name}</h5>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                             onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
                             className={`p-1.5 rounded-lg text-slate-400 hover:bg-sky-50 hover:text-sky-600 transition-colors ${isRegenerating ? 'animate-spin text-sky-500' : ''}`}
                             title="Regenerate this activity"
                         >
                             <RotateCw size={16} />
                         </button>
                         <button 
                             onClick={(e) => { e.stopPropagation(); onDelete(); }}
                             className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                             title="Remove"
                         >
                             <Trash2 size={16} />
                         </button>
                    </div>
                 </div>
                 <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">{activity.description}</p>
                 <div className="flex gap-3 mt-2">
                     {activity.priceLevel && (
                         <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                             <DollarSign size={12} /> {activity.priceLevel}
                         </span>
                     )}
                     {activity.duration && (
                         <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                             <Clock size={12} /> {activity.duration}
                         </span>
                     )}
                 </div>
             </div>
        </div>
    );
};

const ActivityDetailsModal = ({ activity, onClose }: { activity: Activity, onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
             <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                 
                 <div className="relative h-48 bg-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
                     <span className="text-8xl relative z-0 opacity-50 select-none">{activity.emoji}</span>
                     
                     <button 
                         onClick={onClose}
                         className="absolute top-4 right-4 z-20 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors"
                     >
                         <X size={20} />
                     </button>

                     <div className="absolute bottom-0 left-0 p-6 z-20 w-full">
                         <h2 className="text-2xl font-bold text-white mb-1 drop-shadow-md">{activity.name}</h2>
                         <div className="flex items-center gap-2 text-white/90 text-sm">
                             {activity.category && <span className="bg-white/20 px-2 py-0.5 rounded text-xs backdrop-blur-md border border-white/10">{activity.category}</span>}
                         </div>
                     </div>
                 </div>

                 <div className="p-6 overflow-y-auto">
                     <div className="flex gap-4 mb-6">
                         <Button 
                            variant="primary" 
                            fullWidth 
                            onClick={() => window.open(getGoogleMapsUrl(activity.mapsQuery || activity.name), '_blank')}
                         >
                             <Map size={18} className="mr-2" /> Open Maps
                         </Button>
                         {activity.website && (
                             <Button 
                                variant="secondary" 
                                fullWidth
                                onClick={() => window.open(activity.website, '_blank')}
                             >
                                 <ExternalLink size={18} className="mr-2" /> Website
                             </Button>
                         )}
                     </div>

                     <div className="space-y-4">
                         <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                             <p className="text-slate-700 leading-relaxed">{activity.description}</p>
                         </div>

                         <div className="grid grid-cols-2 gap-4">
                             {activity.openingHours && (
                                 <div className="p-3 rounded-xl border border-slate-100">
                                     <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Hours</span>
                                     <span className="text-sm font-medium text-slate-900">{activity.openingHours}</span>
                                 </div>
                             )}
                             {activity.admissionFee && (
                                 <div className="p-3 rounded-xl border border-slate-100">
                                     <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Tickets</span>
                                     <span className="text-sm font-medium text-slate-900">{activity.admissionFee}</span>
                                 </div>
                             )}
                             {activity.rating && (
                                 <div className="p-3 rounded-xl border border-slate-100">
                                     <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Rating</span>
                                     <div className="flex items-center gap-1">
                                        <Star size={14} className="text-amber-400 fill-amber-400" />
                                        <span className="text-sm font-medium text-slate-900">{activity.rating}/5</span>
                                     </div>
                                 </div>
                             )}
                             {activity.priceLevel && (
                                 <div className="p-3 rounded-xl border border-slate-100">
                                     <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block mb-1">Price</span>
                                     <span className="text-sm font-medium text-slate-900">{activity.priceLevel}</span>
                                 </div>
                             )}
                         </div>

                         {activity.isLocalRecommendation && (
                             <div className="flex items-center gap-3 p-3 bg-amber-50 text-amber-800 rounded-xl border border-amber-100">
                                 <Sparkles size={20} className="flex-shrink-0" />
                                 <span className="text-sm font-medium">This is a hidden gem recommended by locals!</span>
                             </div>
                         )}
                     </div>
                 </div>
             </div>
        </div>
    );
};

export default function App() {
  // State
  const [step, setStep] = useState<Step>(Step.START);
  const [isValidating, setIsValidating] = useState(false);
  const [prefs, setPrefs] = useState<UserPreferences>({
    destination: '',
    startDate: '',
    endDate: '',
    hotelLocation: '',
    tripType: 'Couple',
    budget: 'Medium',
    vibe: 'Both',
    pace: 'Balanced',
    interests: [],
    demographics: {},
    fixedPlans: [],
    mustVisit: '',
    followUpAnswers: {},
  });
  
  // Date Picker State
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isFixedPlanDatePickerOpen, setIsFixedPlanDatePickerOpen] = useState(false);
  
  // Temporary state for adding a fixed plan
  const [tempPlan, setTempPlan] = useState<{date: string, desc: string}>({date: '', desc: ''});

  const [smartQuestions, setSmartQuestions] = useState<SmartQuestion[]>([]);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [itineraryId, setItineraryId] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [totalDays, setTotalDays] = useState(0);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  
  // Store images for each day: { dayNumber: base64String }
  const [dayImages, setDayImages] = useState<Record<number, string>>({});
  
  // Store regenerating state for specific activities: Set of strings `${dayNumber}-${period}-${index}`
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set());

  // Modal State
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [regenTarget, setRegenTarget] = useState<{
      dayNum: number, 
      period: 'morning' | 'afternoon' | 'evening', 
      idx: number, 
      activity: Activity, 
      dayContext: DayPlan 
  } | null>(null);

  // Email Sharing State
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Loading Progress
  const [progress, setProgress] = useState(0);

  // --- Tinder Swipe State ---
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [dragDelta, setDragDelta] = useState<{x: number, y: number}>({x: 0, y: 0});
  const [isAnimatingOut, setIsAnimatingOut] = useState<'left' | 'right' | null>(null);

  // Function to process images after itinerary load
  const loadImages = (days: DayPlan[], existingImages: Record<number, string> = {}, id: string) => {
    // Set existing images first
    setDayImages(existingImages);

    // Generate missing images
    days.forEach(async (day) => {
        if (!existingImages[day.dayNumber]) {
            try {
              const img = await generateDayCardImage(
                day.title, day.areaFocus, prefs.destination || 'Destination', day.vibe
              );
              if (img) {
                setDayImages(prev => ({...prev, [day.dayNumber]: img}));
                // Save to DB
                await saveGeneratedImage(id, day.dayNumber, img);
              }
            } catch (err) {
               console.error("Image gen failed", err);
            }
        }
    });
  };

  // Check for shared URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('id');
    const paymentSuccess = params.get('success');
    const sessionId = params.get('session_id');

    if (sharedId) {
        if (paymentSuccess === 'true' && sessionId) {
             // Handle Direct Verification via Session ID
             setStep(Step.VERIFYING_PAYMENT);
             setItineraryId(sharedId);
             
             verifyPayment(sharedId, sessionId).then(success => {
                 if (success) {
                     // Fetch Full Itinerary
                     getItineraryById(sharedId).then(data => {
                         if (data) {
                             setItinerary(data.plan);
                             setItineraryId(data.id);
                             setIsUnlocked(true);
                             setTotalDays(data.totalDays);
                             setStep(Step.ITINERARY);
                             
                             // Load Images
                             loadImages(data.plan.days, data.images, data.id);

                             // Clean URL
                             const newUrl = new URL(window.location.href);
                             newUrl.searchParams.delete('success');
                             newUrl.searchParams.delete('session_id');
                             window.history.replaceState({}, '', newUrl);
                         }
                     });
                 } else {
                     alert("Verification failed. Please try again or contact support.");
                     setStep(Step.START);
                 }
             });

        } else {
            // Normal Load
            setStep(Step.LOADING);
            getItineraryById(sharedId).then(data => {
                if (data && data.plan) {
                    setItinerary(data.plan);
                    setItineraryId(data.id);
                    setIsUnlocked(data.unlocked);
                    setTotalDays(data.totalDays);
                    setStep(Step.ITINERARY);
                    
                    // Load Images
                    loadImages(data.plan.days, data.images, data.id);
                } else {
                    setStep(Step.START);
                }
            });
        }
    }
  }, []);

  // Loading Bar Animation
  useEffect(() => {
    if (step === Step.LOADING) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(p => {
            if (p >= 90) return p;
            const increment = Math.max(0.5, (90 - p) / 20);
            return p + increment;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [step]);

  // Handlers
  const handleStartSubmit = async () => {
    if (!prefs.destination || !prefs.startDate || !prefs.endDate) return;
    
    setIsValidating(true);
    try {
      const result = await validateDestination(prefs.destination);
      if (!result || !result.isValid) {
        alert("We couldn't find that destination. Please check the spelling or try a specific city/country.");
        setIsValidating(false);
        return;
      }
      if (result.formattedName) {
        setPrefs(prev => ({...prev, destination: result.formattedName! }));
      }
      setStep(Step.PREFERENCES);
    } catch (e) {
      console.error("Validation failed", e);
      setStep(Step.PREFERENCES);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePreferencesSubmit = () => {
    if (prefs.tripType === 'Solo' && (!prefs.demographics.gender || !prefs.demographics.age)) {
        alert("Please select your gender and enter your age.");
        return;
    }
    if ((prefs.tripType === 'Couple' || prefs.tripType === 'Friends') && !prefs.demographics.age) {
        alert("Please enter the average age of your group.");
        return;
    }
    if (prefs.tripType === 'Family' && !prefs.demographics.kidsAgeRange) {
        alert("Please select the age range of the children.");
        return;
    }
    setStep(Step.SPECIFICS);
  };

  const handleSpecificsSubmit = async () => {
    setStep(Step.LOADING);
    const questions = await checkEventsAndGetQuestions(prefs);
    if (questions && questions.length > 0) {
      setSmartQuestions(questions);
      setCurrentQuestionIndex(0); 
      setStep(Step.QUESTIONS);
    } else {
      generateTrip();
    }
  };

  const addFixedPlan = () => {
    if (tempPlan.date && tempPlan.desc) {
      setPrefs({
        ...prefs,
        fixedPlans: [...prefs.fixedPlans, { 
            id: Math.random().toString(36).substr(2, 9), 
            date: tempPlan.date, 
            description: tempPlan.desc 
        }]
      });
      setTempPlan({date: '', desc: ''});
    }
  };

  const removeFixedPlan = (id: string) => {
    setPrefs({
        ...prefs,
        fixedPlans: prefs.fixedPlans.filter(p => p.id !== id)
    });
  };

  // --- SWIPE LOGIC START ---
  const handleSwipeComplete = (direction: 'left' | 'right') => {
    if (isAnimatingOut) return;
    const currentQ = smartQuestions[currentQuestionIndex];
    if (!currentQ) return;
    setIsAnimatingOut(direction);
    setDragDelta({ x: direction === 'right' ? 500 : -500, y: 0 }); 

    const answer = direction === 'right'; 
    setPrefs(prev => ({
      ...prev,
      followUpAnswers: { ...prev.followUpAnswers, [currentQ.id]: answer }
    }));

    setTimeout(() => {
        setIsAnimatingOut(null);
        setDragDelta({ x: 0, y: 0 });
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex >= smartQuestions.length) {
            handleQuestionsComplete();
        } else {
            setCurrentQuestionIndex(nextIndex);
        }
    }, 300);
  };

  const onPointerDown = (e: React.PointerEvent | React.TouchEvent) => {
      if (isAnimatingOut) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
      setDragStart({ x: clientX, y: clientY });
  };

  const onPointerMove = (e: React.PointerEvent | React.TouchEvent) => {
      if (!dragStart || isAnimatingOut) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.PointerEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.PointerEvent).clientY;
      setDragDelta({ x: clientX - dragStart.x, y: clientY - dragStart.y });
  };

  const onPointerUp = () => {
      if (!dragStart || isAnimatingOut) return;
      const threshold = 100;
      if (dragDelta.x > threshold) {
          handleSwipeComplete('right');
      } else if (dragDelta.x < -threshold) {
          handleSwipeComplete('left');
      } else {
          setDragDelta({ x: 0, y: 0 });
      }
      setDragStart(null);
  };
  // --- SWIPE LOGIC END ---

  const handleQuestionsComplete = () => {
    setStep(Step.LOADING);
    generateTrip();
  };

  const generateTrip = async () => {
    const result = await generateItinerary(prefs);
    if (result && result.plan) {
      setItinerary(result.plan);
      setItineraryId(result.id);
      setIsUnlocked(result.unlocked);
      setTotalDays(result.totalDays);
      setStep(Step.ITINERARY);
      setEmailModalOpen(true); // Open email modal immediately upon success
      
      // Update URL without reload to allow sharing immediately
      const url = new URL(window.location.href);
      url.searchParams.set('id', result.id);
      window.history.pushState({}, '', url);
      
      // Load Images (Check if empty object, likely is for new trip)
      loadImages(result.plan.days, {}, result.id);

    } else {
      alert("Something went wrong generating your trip.");
      setStep(Step.START);
    }
  };

  const handlePayment = async () => {
      if (!itineraryId) return;
      setIsLoadingPayment(true);
      const url = await createCheckoutSession(itineraryId);
      if (url) {
          window.location.href = url;
      } else {
          alert("Could not initialize payment. Please check console/keys.");
          setIsLoadingPayment(false);
      }
  };

  const handleEmailSubmit = async () => {
    if (!userEmail || !itineraryId) return;
    setIsSavingEmail(true);
    await saveUserEmail(userEmail, itineraryId);
    setIsSavingEmail(false);
    setEmailModalOpen(false);
  };

  const openRegenerateModal = (dayNum: number, period: 'morning' | 'afternoon' | 'evening', idx: number, activity: Activity, dayContext: DayPlan) => {
      setRegenTarget({ dayNum, period, idx, activity, dayContext });
      setRegenModalOpen(true);
  };

  const confirmRegeneration = async (instruction: string) => {
    if (!regenTarget) return;
    setRegenModalOpen(false);

    const { dayNum, period, idx, activity, dayContext } = regenTarget;
    const id = `${dayNum}-${period}-${idx}`;
    setRegeneratingIds(prev => new Set(prev).add(id));

    const existingNames: string[] = [];
    if (itinerary && itinerary.days) {
        itinerary.days.forEach(d => {
            if (d.morning) d.morning.forEach(a => existingNames.push(a.name));
            if (d.afternoon) d.afternoon.forEach(a => existingNames.push(a.name));
            if (d.evening) d.evening.forEach(a => existingNames.push(a.name));
        });
    }

    try {
        const newActivity = await getAlternativeActivity(
            prefs, activity, { dayTitle: dayContext.title, area: dayContext.areaFocus, timeOfDay: period }, existingNames, instruction
        );
        if (newActivity) {
            setItinerary(prev => {
                if (!prev || !prev.days) return null;
                const newDays = prev.days.map(d => {
                    if (d.dayNumber !== dayNum) return d;
                    const activities = d[period] || [];
                    const newActivities = [...activities];
                    if (newActivities[idx]) newActivities[idx] = newActivity;
                    return { ...d, [period]: newActivities };
                });
                return { ...prev, days: newDays };
            });
        }
    } catch (e) { console.error("Failed to redo", e); } finally {
        setRegeneratingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        setRegenTarget(null);
    }
  };

  const handleDeleteActivity = (dayNum: number, period: 'morning' | 'afternoon' | 'evening', idx: number) => {
    setItinerary(prev => {
        if (!prev || !prev.days) return null;
        const newDays = prev.days.map(d => {
            if (d.dayNumber !== dayNum) return d;
            const list = d[period] || [];
            const newList = [...list];
            newList.splice(idx, 1);
            return { ...d, [period]: newList };
        });
        return { ...prev, days: newDays };
    });
  };

  // --- Renders ---
  
  if (step === Step.START) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-start pt-8 md:pt-24 p-6 bg-gradient-to-br from-sky-50 to-indigo-50">
        <div className="max-w-md w-full space-y-8 animate-fade-in-up">
          <div className="text-center space-y-2">
            <div className="inline-flex p-3 rounded-2xl bg-sky-100 text-sky-600 mb-2">
              <Plane size={32} />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Trip Daddy AI</h1>
            <p className="text-slate-500 text-lg">Design your perfect trip in seconds</p>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 space-y-5 relative z-0">
            <Input 
              label="Where to?" 
              placeholder="e.g. Tokyo, Japan" 
              value={prefs.destination}
              onChange={(e) => setPrefs({...prefs, destination: e.target.value})}
            />
            
            <div className="relative">
                <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">Travel Dates</label>
                <div 
                    onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-white text-slate-900 flex items-center justify-between cursor-pointer hover:border-sky-500 transition-colors relative z-10"
                >
                    <span className={!prefs.startDate ? 'text-slate-400' : 'text-slate-900 font-medium'}>
                        {prefs.startDate ? (
                            <>
                                {formatDate(prefs.startDate)} 
                                {prefs.endDate ? ` — ${formatDate(prefs.endDate)}` : ' — Select End Date'}
                            </>
                        ) : 'Select Travel Dates'}
                    </span>
                    <Calendar size={20} className="text-slate-400" />
                </div>

                {isDatePickerOpen && (
                    <>
                        <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setIsDatePickerOpen(false)}
                        ></div>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20">
                            <DateRangePicker 
                                startDate={prefs.startDate} 
                                endDate={prefs.endDate} 
                                onChange={(start, end) => setPrefs({...prefs, startDate: start, endDate: end})}
                                onClose={() => setIsDatePickerOpen(false)}
                            />
                        </div>
                    </>
                )}
            </div>

            <Input 
              label="Hotel Location (Optional)" 
              placeholder="Area or Hotel Name" 
              value={prefs.hotelLocation}
              onChange={(e) => setPrefs({...prefs, hotelLocation: e.target.value})}
            />

            <Button 
                fullWidth 
                size="lg" 
                onClick={handleStartSubmit} 
                disabled={!prefs.destination || !prefs.startDate || !prefs.endDate || isValidating}
            >
              {isValidating ? (
                  <span className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin" size={20}/>
                  </span>
              ) : (
                  <span className="flex items-center justify-center gap-2">
                      Start Planning <ArrowRight className="w-5 h-5" />
                  </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // ... (PREFERENCES Step)
  if (step === Step.PREFERENCES) {
    return (
      <div className="min-h-screen bg-slate-50 pb-28">
        <div className="max-w-2xl mx-auto p-6 space-y-8">
          <div className="text-center pt-8">
            <h2 className="text-3xl font-bold text-slate-900">Tailor your experience</h2>
            <p className="text-slate-500 mt-2">Tap the options that suit you best</p>
          </div>

          <section>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 ml-1">Who are you traveling with?</h3>
            <div className="grid grid-cols-4 gap-3">
              {['Solo', 'Couple', 'Friends', 'Family'].map((type) => {
                let icon = <Users size={20} />;
                if (type === 'Solo') icon = <User size={20} />;
                if (type === 'Family') icon = (
                   <div className="flex items-center justify-center pl-2">
                     <User size={20} className="z-10" />
                     <User size={18} className="-ml-1 text-slate-400" />
                     <User size={18} className="-ml-1 text-slate-300" />
                   </div>
                );

                return (
                    <SelectableCard 
                      key={type}
                      label={type}
                      selected={prefs.tripType === type}
                      onClick={() => setPrefs({...prefs, tripType: type as TripType, demographics: {} })}
                      icon={icon}
                    />
                );
              })}
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
             <h3 className="text-lg font-semibold text-slate-700 mb-4">About You</h3>
             
             {prefs.tripType === 'Solo' && (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">Gender</label>
                    <div className="flex gap-3 h-[54px]">
                        <SelectableCard 
                            label="Male" 
                            selected={prefs.demographics.gender === 'Male'} 
                            onClick={() => setPrefs({...prefs, demographics: {...prefs.demographics, gender: 'Male'}})} 
                            className="h-full"
                        />
                        <SelectableCard 
                            label="Female" 
                            selected={prefs.demographics.gender === 'Female'} 
                            onClick={() => setPrefs({...prefs, demographics: {...prefs.demographics, gender: 'Female'}})} 
                            className="h-full"
                        />
                    </div>
                  </div>
                  <Input 
                    label="Age" 
                    type="number"
                    value={prefs.demographics.age || ''}
                    onChange={(e) => setPrefs({...prefs, demographics: {...prefs.demographics, age: e.target.value}})}
                  />
               </div>
             )}

             {(prefs.tripType === 'Couple' || prefs.tripType === 'Friends') && (
               <Input 
                 label="Average Age of Group" 
                 type="number"
                 placeholder="e.g. 28"
                 value={prefs.demographics.age || ''}
                 onChange={(e) => setPrefs({...prefs, demographics: {...prefs.demographics, age: e.target.value}})}
               />
             )}

             {prefs.tripType === 'Family' && (
                <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">Kids Age Range</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {['0-5', '5-10', '10-15', '15-20'].map(range => (
                            <button
                                key={range}
                                onClick={() => setPrefs({...prefs, demographics: {...prefs.demographics, kidsAgeRange: range as KidsAgeRange}})}
                                className={`px-4 py-3 rounded-xl border-2 font-medium transition-colors ${prefs.demographics.kidsAgeRange === range ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-100 hover:border-slate-200'}`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>
             )}
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 ml-1">What's the vibe?</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'Extreme/Fun', label: 'Fun', icon: <Zap size={20}/> },
                { id: 'Both', label: 'Balanced', icon: <Scale size={20}/> },
                { id: 'Laid back/Chill', label: 'Chill', icon: <Coffee size={20}/> },
              ].map((v) => (
                <SelectableCard 
                  key={v.id}
                  label={v.label}
                  selected={prefs.vibe === v.id}
                  onClick={() => setPrefs({...prefs, vibe: v.id as VibeType})}
                  icon={v.icon}
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 ml-1">Pace</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'Slow', label: 'Slow', icon: <Leaf size={20}/> },
                { id: 'Balanced', label: 'Balanced', icon: <Scale size={20}/> },
                { id: 'Fast', label: 'Fast', icon: <Rabbit size={20}/> },
              ].map((p) => (
                <SelectableCard 
                  key={p.id}
                  label={p.label}
                  selected={prefs.pace === p.id}
                  onClick={() => setPrefs({...prefs, pace: p.id as PaceType})}
                  icon={p.icon}
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 ml-1">Budget</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'Low', label: 'Low', symbol: '$' },
                { id: 'Medium', label: 'Medium', symbol: '$$' },
                { id: 'High', label: 'High', symbol: '$$$' },
              ].map((item) => (
                <SelectableCard 
                  key={item.id}
                  label={item.label}
                  selected={prefs.budget === item.id}
                  onClick={() => setPrefs({...prefs, budget: item.id as BudgetLevel})}
                  icon={<span className="text-2xl font-bold font-serif">{item.symbol}</span>}
                />
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-slate-700 mb-4 ml-1">Interests (Select multiple)</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'Dining', icon: <Utensils size={20}/> },
                { id: 'Nightlife', icon: <Moon size={20}/> },
                { id: 'Culture', icon: <Landmark size={20}/> },
                { id: 'Active', icon: <ActivityIcon size={20}/> },
                { id: 'Viewpoints', icon: <Camera size={20}/> },
                { id: 'Nature', icon: <Mountain size={20}/> },
                { id: 'Shopping', icon: <ShoppingBag size={20}/> },
                { id: 'Local Experiences', icon: <Sparkles size={20}/> },
                { id: 'Shows & Concerts', icon: <Ticket size={20}/> },
              ].map((item) => (
                <SelectableCard 
                  key={item.id}
                  label={item.id}
                  selected={prefs.interests.includes(item.id as Interest)}
                  multiSelect
                  icon={item.icon}
                  onClick={() => {
                    const newInterests = prefs.interests.includes(item.id as Interest)
                      ? prefs.interests.filter(i => i !== item.id)
                      : [...prefs.interests, item.id as Interest];
                    setPrefs({...prefs, interests: newInterests});
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex justify-center z-10">
          <div className="max-w-2xl w-full flex gap-3">
             <Button variant="secondary" onClick={() => setStep(Step.START)} className="px-4">
                <ChevronLeft size={24} />
             </Button>
             <div className="flex-1">
                <Button fullWidth size="lg" onClick={handlePreferencesSubmit}>
                  Next
                </Button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // ... (SPECIFICS Step)
  if (step === Step.SPECIFICS) {
    const hasSpecifics = prefs.fixedPlans.length > 0 || prefs.mustVisit.trim().length > 0 || tempPlan.date !== '' || tempPlan.desc !== '';

    return (
      <div className="min-h-screen bg-slate-50 pb-20">
         <div className="max-w-2xl mx-auto p-6 space-y-8">
            <div className="text-center pt-8">
                <h2 className="text-3xl font-bold text-slate-900">Existing Plans?</h2>
                <p className="text-slate-500 mt-2">Tell us what you've already booked or must see</p>
            </div>

            <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                    <Pin size={20} className="text-sky-500"/> Fixed Plans
                </h3>
                <p className="text-sm text-slate-400">Add any plans you already have (The entire day will be allocated to your pre-existing activity)</p>
                
                <div className="flex gap-2 items-end">
                    <div className="flex-1 relative min-w-0">
                        <label className="block text-sm font-medium text-slate-600 mb-1.5 ml-1">Date</label>
                        <div 
                            onClick={() => setIsFixedPlanDatePickerOpen(!isFixedPlanDatePickerOpen)}
                            className="w-full h-[54px] px-3 rounded-xl border border-slate-200 bg-white text-slate-900 flex items-center justify-between cursor-pointer hover:border-sky-500 transition-colors"
                        >
                            <span className={`text-sm truncate ${!tempPlan.date ? 'text-slate-400' : 'text-slate-900 font-medium'}`}>
                                {tempPlan.date ? formatDate(tempPlan.date) : 'Select Date'}
                            </span>
                            <Calendar size={16} className="text-slate-400 flex-shrink-0 ml-1" />
                        </div>

                        {isFixedPlanDatePickerOpen && (
                            <>
                                <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setIsFixedPlanDatePickerOpen(false)}
                                ></div>
                                <div className="absolute top-full left-0 mt-2 z-20">
                                    <SingleDatePicker 
                                        date={tempPlan.date}
                                        minDate={prefs.startDate}
                                        maxDate={prefs.endDate}
                                        onChange={(date) => setTempPlan({...tempPlan, date})}
                                        onClose={() => setIsFixedPlanDatePickerOpen(false)}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <Input 
                            label="Description"
                            placeholder="Meeting"
                            value={tempPlan.desc}
                            onChange={(e) => setTempPlan({...tempPlan, desc: e.target.value})}
                            className="h-[54px]" 
                        />
                    </div>
                    <button 
                        onClick={addFixedPlan}
                        disabled={!tempPlan.date || !tempPlan.desc}
                        className="mb-[2px] h-[54px] w-[54px] flex items-center justify-center bg-sky-100 text-sky-600 rounded-xl hover:bg-sky-200 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                        <Plus size={24} />
                    </button>
                </div>

                {prefs.fixedPlans.length > 0 && (
                    <div className="space-y-2 mt-4">
                        {prefs.fixedPlans.map(plan => (
                            <div key={plan.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="overflow-hidden">
                                    <span className="font-semibold text-sky-900 mr-2">{formatDate(plan.date)}:</span>
                                    <span className="text-slate-700 truncate">{plan.description}</span>
                                </div>
                                <button onClick={() => removeFixedPlan(plan.id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-lg font-semibold text-slate-700 flex items-center gap-2">
                    <Sparkles size={20} className="text-amber-500"/> Must Visit
                </h3>
                <p className="text-sm text-slate-400">Tell us about the activities or places you want included (we'll figure out the best time to visit based on the location)</p>
                <textarea 
                    className="w-full p-4 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all resize-none h-32"
                    placeholder="e.g. I really want to see the Van Gogh museum and eat at a specific ramen shop."
                    value={prefs.mustVisit}
                    onChange={(e) => setPrefs({...prefs, mustVisit: e.target.value})}
                />
            </section>
         </div>

         <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-slate-100 flex justify-center z-10">
          <div className="max-w-2xl w-full flex gap-3">
             <Button variant="secondary" onClick={() => setStep(Step.PREFERENCES)} className="px-4">
                <ChevronLeft size={24} />
             </Button>
             <div className="flex-1">
                <Button fullWidth size="lg" onClick={handleSpecificsSubmit}>
                  {hasSpecifics ? "Analyze & Finish" : "Skip"}
                </Button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  // ... (QUESTIONS Step)
  if (step === Step.QUESTIONS) {
    const activeQuestion = smartQuestions[currentQuestionIndex];
    const nextQuestion = smartQuestions[currentQuestionIndex + 1];
    
    const rotate = dragDelta.x * 0.05; 
    const opacityYes = dragDelta.x > 0 ? Math.min(dragDelta.x / 100, 1) : 0;
    const opacityNo = dragDelta.x < 0 ? Math.min(Math.abs(dragDelta.x) / 100, 1) : 0;

    const getSafeEmoji = (emoji?: string) => {
        // Simple check if emoji is valid, otherwise fallback
        return emoji && !/[a-zA-Z]/.test(emoji) ? emoji : '⭐';
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 overflow-hidden">
        <div className="max-w-md w-full space-y-8 flex flex-col items-center">
          
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Refine your trip</h2>
            <p className="text-slate-500 mb-4">Swipe Right for YES, Left for NO</p>
            {/* Improved Counter */}
            <span className="bg-slate-800 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md">
                Question {currentQuestionIndex + 1} / {smartQuestions.length}
            </span>
          </div>

          <div className="relative w-full h-[400px]">
             
             {/* Next Card */}
             {nextQuestion && (
                 <div className="absolute inset-0 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 transform scale-95 translate-y-4 opacity-50 z-0 flex flex-col justify-center items-center text-center">
                     <div className="text-4xl mb-6 opacity-50">{getSafeEmoji(nextQuestion.emoji)}</div>
                     <p className="font-bold text-xl text-slate-800 mb-2 opacity-60 line-clamp-2">{nextQuestion.title}</p>
                     <p className="text-sm text-slate-400 opacity-60 line-clamp-3">{nextQuestion.description}</p>
                 </div>
             )}

             {/* Active Card */}
             {activeQuestion && (
                <div 
                    className="absolute inset-0 bg-white p-8 rounded-3xl shadow-xl border border-slate-100 z-10 cursor-grab active:cursor-grabbing touch-none flex flex-col justify-center items-center text-center select-none"
                    style={{
                        transform: `translate(${dragDelta.x}px, ${dragDelta.y}px) rotate(${rotate}deg)`,
                        transition: isAnimatingOut ? 'transform 0.3s ease-out' : 'none'
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                    onTouchStart={onPointerDown}
                    onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp}
                >
                    <div 
                        className="absolute top-8 right-8 border-4 border-green-500 text-green-500 rounded-lg px-4 py-2 font-black text-2xl uppercase opacity-0 transform rotate-12"
                        style={{ opacity: opacityYes }}
                    >
                        YES
                    </div>
                    <div 
                        className="absolute top-8 left-8 border-4 border-red-500 text-red-500 rounded-lg px-4 py-2 font-black text-2xl uppercase opacity-0 transform -rotate-12"
                        style={{ opacity: opacityNo }}
                    >
                        NO
                    </div>

                    {/* Smaller Emoji */}
                    <div className="mb-6 bg-slate-50 text-slate-900 p-6 rounded-full text-4xl shadow-inner">
                        {getSafeEmoji(activeQuestion.emoji)}
                    </div>
                    
                    <p className="font-bold text-3xl text-slate-900 mb-4 leading-tight">{activeQuestion.title}</p>
                    
                    {/* Clamped Text */}
                    <p className="text-lg text-slate-500 leading-relaxed max-w-[90%] line-clamp-4 overflow-hidden text-ellipsis">
                        {activeQuestion.description}
                    </p>
                </div>
             )}
          </div>

          <div className="flex gap-8 items-center justify-center pt-4">
             <button 
                onClick={() => handleSwipeComplete('left')}
                className="w-16 h-16 flex items-center justify-center rounded-full bg-white border-2 border-slate-200 text-red-500 shadow-sm hover:scale-110 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
             >
                <X size={32} strokeWidth={3} />
             </button>
             
             <button 
                onClick={() => handleSwipeComplete('right')}
                className="w-16 h-16 flex items-center justify-center rounded-full bg-white border-2 border-slate-200 text-green-500 shadow-sm hover:scale-110 hover:bg-green-50 hover:border-green-200 transition-all active:scale-95"
             >
                <Check size={32} strokeWidth={3} />
             </button>
          </div>

        </div>
      </div>
    );
  }

  // ... (LOADING Step)
  if (step === Step.LOADING) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-sky-100 opacity-75"></div>
          <div className="relative bg-sky-50 p-6 rounded-full text-sky-600">
             <Map className="w-12 h-12 animate-bounce" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mt-8 mb-2">Crafting your perfect trip...</h2>
        <p className="text-slate-500 max-w-xs mx-auto mb-8">Analyzing demographics, checking local gems, and organizing your fixed plans</p>
        
        <div className="w-full max-w-xs bg-slate-100 rounded-full h-2 overflow-hidden">
            <div 
                className="bg-sky-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
            ></div>
        </div>
      </div>
    );
  }
  
  if (step === Step.VERIFYING_PAYMENT) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <div className="relative mb-8">
           <Loader2 className="w-16 h-16 animate-spin text-sky-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Verifying Payment...</h2>
        <p className="text-slate-500 max-w-xs mx-auto">Please wait while we confirm your transaction and unlock your full itinerary.</p>
      </div>
    );
  }

  // ... (ITINERARY Step - UPDATED FOR LOCKING)
  if (step === Step.ITINERARY && itinerary && itinerary.days) {
    // Determine how many days to show (Locked = max 2)
    const displayDays = isUnlocked ? itinerary.days : itinerary.days.slice(0, 2);
    const lockedDaysCount = totalDays - displayDays.length;

    return (
      <div className="min-h-screen bg-slate-50 relative">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">{itinerary.destination}</h1>
                    <p className="text-sm text-slate-500">
                      {isUnlocked ? (
                         <span className="flex items-center gap-1 text-green-600"><Check size={14} /> Full Itinerary</span>
                      ) : (
                         <span className="flex items-center gap-1 text-amber-600"><Lock size={14} /> Preview Mode</span>
                      )}
                    </p>
                </div>
                <div className="flex gap-2">
                   {/* Share Button (Only visible when unlocked for now, or always?) - Let's allow sharing anytime */}
                   <button 
                       onClick={() => setEmailModalOpen(true)}
                       className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors flex items-center gap-2"
                       title="Share Itinerary"
                   >
                       <Share2 size={20} />
                       <span className="hidden sm:inline text-sm font-medium">Share</span>
                   </button>
                   <button onClick={() => setStep(Step.START)} className="p-2 text-slate-400 hover:text-slate-600">
                     <X size={20} />
                   </button>
                </div>
            </div>
        </header>

        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-8 pb-20">
          
          {displayDays.map((day) => (
            <div key={day.dayNumber} className="relative">
                {/* Day Header Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-6">
                    <div className="h-48 w-full bg-slate-100 relative overflow-hidden group">
                         {dayImages[day.dayNumber] ? (
                            <img 
                                src={dayImages[day.dayNumber]} 
                                alt={day.title} 
                                className="w-full h-full object-cover animate-fade-in transition-transform duration-700 group-hover:scale-105" 
                            />
                         ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
                                <span className="text-xs font-medium text-slate-400">Painting a cute scene...</span>
                            </div>
                         )}
                         <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                         <div className="absolute bottom-0 left-0 p-6 text-white w-full">
                              <div className="flex justify-between items-end">
                                  <div>
                                    <h2 className="text-3xl font-bold tracking-tight">Day {day.dayNumber}</h2>
                                    <p className="font-medium opacity-90">{day.date}</p> 
                                  </div>
                              </div>
                         </div>
                    </div>

                    <div className="p-6">
                        <div className="flex justify-between items-start mb-2">
                             <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-1">{day.title}</h3>
                                <p className="text-slate-500 flex items-center gap-1">
                                    <MapPin size={16} /> {day.areaFocus}
                                </p>
                             </div>
                             <div className="flex gap-1">
                                {day.vibeIcons?.map((icon, i) => <span key={i} className="text-2xl">{icon}</span>)}
                             </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 pl-3 md:pl-6 border-l-2 border-slate-200 ml-0 md:ml-4 relative">
                    {/* Morning */}
                    {day.morning?.length > 0 && (
                        <div className="relative">
                            <div className="absolute -left-[19px] md:-left-[31px] top-0 w-4 h-4 rounded-full bg-white border-4 border-amber-300"></div>
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Morning</h4>
                            <div className="space-y-3">
                                {day.morning.map((activity, idx) => (
                                    <ActivityCard 
                                        key={idx} 
                                        activity={activity} 
                                        onDetailsClick={() => setSelectedActivity(activity)}
                                        onRegenerate={() => openRegenerateModal(day.dayNumber, 'morning', idx, activity, day)}
                                        onDelete={() => handleDeleteActivity(day.dayNumber, 'morning', idx)}
                                        isRegenerating={regeneratingIds.has(`${day.dayNumber}-morning-${idx}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Afternoon */}
                    {day.afternoon?.length > 0 && (
                        <div className="relative pt-4">
                             <div className="absolute -left-[19px] md:-left-[31px] top-4 w-4 h-4 rounded-full bg-white border-4 border-orange-400"></div>
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Afternoon</h4>
                            <div className="space-y-3">
                                {day.afternoon.map((activity, idx) => (
                                    <ActivityCard 
                                        key={idx} 
                                        activity={activity} 
                                        onDetailsClick={() => setSelectedActivity(activity)}
                                        onRegenerate={() => openRegenerateModal(day.dayNumber, 'afternoon', idx, activity, day)}
                                        onDelete={() => handleDeleteActivity(day.dayNumber, 'afternoon', idx)}
                                        isRegenerating={regeneratingIds.has(`${day.dayNumber}-afternoon-${idx}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Evening */}
                    {day.evening?.length > 0 && (
                        <div className="relative pt-4">
                             <div className="absolute -left-[19px] md:-left-[31px] top-4 w-4 h-4 rounded-full bg-white border-4 border-indigo-500"></div>
                            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Evening</h4>
                            <div className="space-y-3">
                                {day.evening.map((activity, idx) => (
                                    <ActivityCard 
                                        key={idx} 
                                        activity={activity} 
                                        onDetailsClick={() => setSelectedActivity(activity)}
                                        onRegenerate={() => openRegenerateModal(day.dayNumber, 'evening', idx, activity, day)}
                                        onDelete={() => handleDeleteActivity(day.dayNumber, 'evening', idx)}
                                        isRegenerating={regeneratingIds.has(`${day.dayNumber}-evening-${idx}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {day.highlightEvent && (
                    <div className="mt-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-500/20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <Sparkles size={18} className="text-yellow-300"/>
                                <span className="font-bold text-sm tracking-wide text-white/90 uppercase">Special Event</span>
                            </div>
                            <h3 className="text-2xl font-bold mb-2">{day.highlightEvent.name}</h3>
                            <p className="text-white/80 text-sm mb-4 leading-relaxed">{day.highlightEvent.description}</p>
                            <a 
                                href={getGoogleSearchUrl(day.highlightEvent.name)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors border border-white/20"
                            >
                                <Search size={14} /> View Details
                            </a>
                        </div>
                    </div>
                )}
            </div>
          ))}

          {/* LOCKED STATE OVERLAY */}
          {!isUnlocked && lockedDaysCount > 0 && (
             <div className="relative mt-8 rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-white">
                {/* Simulated Blurred Content */}
                <div className="p-8 filter blur-sm opacity-50 pointer-events-none select-none">
                     <div className="h-48 bg-slate-200 rounded-2xl mb-6"></div>
                     <div className="space-y-4">
                         <div className="h-20 bg-slate-100 rounded-xl"></div>
                         <div className="h-20 bg-slate-100 rounded-xl"></div>
                         <div className="h-20 bg-slate-100 rounded-xl"></div>
                     </div>
                </div>

                {/* Lock CTA */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-sm z-10 p-6 text-center">
                    <div className="bg-white p-4 rounded-full shadow-lg mb-4 text-amber-500">
                        <div className="bg-amber-100 p-3 rounded-full inline-flex mb-3">
                          <Lock size={28} className="text-amber-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Unlock {lockedDaysCount} More Days</h3>
                        <p className="text-slate-600 mb-6 max-w-sm">
                            Get access to the full itinerary, including hidden gems, logistic details, and optimization tools.
                        </p>
                        <Button onClick={handlePayment} size="lg" className="px-10 py-4 shadow-xl shadow-sky-500/30" disabled={isLoadingPayment}>
                            {isLoadingPayment ? <Loader2 className="animate-spin" /> : (
                                <span className="flex items-center gap-2">
                                    <CreditCard size={20} /> Pay $5.00 to Unlock
                                </span>
                            )}
                        </Button>
                        <p className="mt-4 text-xs text-slate-400">Secure payment via Stripe</p>
                    </div>
                </div>
             </div>
          )}

        </div>

        {selectedActivity && (
            <ActivityDetailsModal 
                activity={selectedActivity} 
                onClose={() => setSelectedActivity(null)} 
            />
        )}
        
        {regenModalOpen && regenTarget && (
            <RegenerateModal
                isOpen={regenModalOpen}
                onClose={() => setRegenModalOpen(false)}
                onConfirm={confirmRegeneration}
                activityName={regenTarget.activity.name}
            />
        )}
        
        {/* EMAIL CAPTURE MODAL - Shows immediately after trip generation */}
        {emailModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
                <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 animate-fade-in-up text-center">
                    <div className="mx-auto w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-6">
                        <Mail size={32} className="text-sky-600"/> 
                    </div>
                    
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        Your Trip is Ready!
                    </h3>
                    
                    <p className="text-slate-600 mb-6">
                        Enter your email to receive your personalized itinerary link. We'll send you a preview now, and the full unlocked version once confirmed.
                    </p>

                    <Input 
                        placeholder="name@example.com"
                        type="email"
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        className="mb-4"
                        autoFocus
                    />

                    <Button 
                        fullWidth 
                        size="lg"
                        onClick={handleEmailSubmit} 
                        disabled={!userEmail || isSavingEmail}
                    >
                        {isSavingEmail ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="animate-spin" /> Sending...
                            </span>
                        ) : 'Reveal My Trip'}
                    </Button>
                    
                    <p className="mt-4 text-xs text-slate-400">
                        We respect your privacy. No spam, just your travel plans.
                    </p>
                </div>
            </div>
        )}
      </div>
    );
  }

  return null;
}
