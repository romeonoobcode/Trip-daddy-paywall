
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { Itinerary } from './models/Itinerary';
import * as aiService from './services/aiService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
    apiVersion: '2023-10-16',
});

// Initialize Resend via Nodemailer
// Resend SMTP credentials:
// User: resend
// Pass: Your Resend API Key (re_123...)
// Host: smtp.resend.com
const transporter = nodemailer.createTransport({
    host: 'smtp.resend.com',
    port: 465,
    secure: true,
    auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY || process.env.EMAIL_PASS
    }
});

const SENDER_EMAIL = process.env.EMAIL_USER || 'onboarding@resend.dev'; // Use your verified Resend domain here

// Middleware
app.use((req, res, next) => {
  if (req.originalUrl === '/api/webhook') {
    next();
  } else {
    // Increase limit for base64 images
    express.json({ limit: '50mb' })(req, res, next);
  }
});
app.use(cors());

// Connect DB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/tripdaddy')
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- HELPER ---
const maskPlan = (plan: any) => {
    if (!plan || !Array.isArray(plan.days)) return plan;
    return {
        ...plan,
        days: plan.days.slice(0, 2)
    };
};

const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        await transporter.sendMail({
            from: `"Trip Daddy AI" <${SENDER_EMAIL}>`,
            to,
            subject,
            html
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error("Failed to send email:", error);
    }
};

// --- AI ROUTES ---

app.post('/api/validate-destination', async (req, res) => {
    try {
        const result = await aiService.validateDestination(req.body.destination);
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Validation failed' }); }
});

app.post('/api/check-events', async (req, res) => {
    try {
        const result = await aiService.checkEventsAndGetQuestions(req.body.prefs);
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Check events failed' }); }
});

app.post('/api/generate-trip', async (req, res) => {
    try {
        const fullPlan = await aiService.generateItinerary(req.body.prefs);
        if (!fullPlan) return res.status(500).json({ error: 'Generation failed' });

        const id = crypto.randomUUID();
        const newItinerary = new Itinerary({
            id,
            unlocked: false,
            plan: fullPlan,
            images: {}
        });
        await newItinerary.save();

        res.json({ 
            id, 
            plan: maskPlan(fullPlan),
            unlocked: false,
            totalDays: fullPlan.days.length,
            images: {}
        });
    } catch (e) { 
        console.error(e);
        res.status(500).json({ error: 'Generation failed' }); 
    }
});

app.post('/api/alternative-activity', async (req, res) => {
    try {
        const { prefs, currentActivity, context, existingNames, customRequest } = req.body;
        const result = await aiService.getAlternativeActivity(prefs, currentActivity, context, existingNames, customRequest);
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Alternative failed' }); }
});

app.post('/api/generate-image', async (req, res) => {
    try {
        const { dayTitle, area, destination, vibe } = req.body;
        const image = await aiService.generateDayCardImage(dayTitle, area, destination, vibe);
        res.json({ image });
    } catch (e) { res.status(500).json({ error: 'Image gen failed' }); }
});

// --- IMAGE SAVING ROUTE ---
app.post('/api/save-image', async (req, res) => {
    try {
        const { itineraryId, dayNumber, image } = req.body;
        
        await Itinerary.findOneAndUpdate(
            { id: itineraryId },
            { $set: { [`images.${dayNumber}`]: image } }
        );
        
        res.json({ success: true });
    } catch (e) {
        console.error("Save Image Error:", e);
        res.status(500).json({ error: 'Failed to save image' });
    }
});

// --- EMAIL & STRIPE ROUTES ---

// 1. Save Email & Send First "Preview" Email
app.post('/api/save-email', async (req, res) => {
    try {
        const { email, itineraryId } = req.body;
        
        const itinerary = await Itinerary.findOneAndUpdate(
            { id: itineraryId },
            { email: email },
            { new: true } // Return updated doc
        );

        if (!itinerary) return res.status(404).json({ error: "Itinerary not found" });

        const shareUrl = `${req.headers.origin || 'http://localhost:3000'}/?id=${itineraryId}`;
        const destination = itinerary.plan.destination;

        // SEND EMAIL 1: PREVIEW
        await sendEmail(
            email,
            `✈️ Your Trip to ${destination} is ready!`,
            `
            <div style="font-family: sans-serif; color: #334155;">
                <h2>Your itinerary for ${destination} is ready.</h2>
                <p>We've crafted a custom plan based on your preferences. You can view the first 2 days for free right now.</p>
                <a href="${shareUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                    View Itinerary
                </a>
            </div>
            `
        );

        res.json({ success: true });
    } catch (e) {
        console.error("Save Email Error:", e);
        res.status(500).json({ error: 'Failed' });
    }
});

app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { itineraryId } = req.body;
        
        const itinerary = await Itinerary.findOne({ id: itineraryId });
        if (!itinerary) return res.status(404).json({ error: 'Itinerary not found' });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Full Itinerary: ${itinerary.plan.destination}`,
                            description: 'Unlock the complete day-by-day travel plan including hidden gems and logistics.',
                        },
                        unit_amount: 500,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${req.headers.origin || 'http://localhost:3000'}/?id=${itineraryId}&success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin || 'http://localhost:3000'}/?id=${itineraryId}&canceled=true`,
            client_reference_id: itineraryId,
            customer_email: itinerary.email || undefined, // Pre-fill email in Stripe if we have it
        });

        res.json({ url: session.url });
    } catch (e) {
        console.error("Stripe Error:", e);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// 2. Verify Payment & Send Second "Unlocked" Email
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { sessionId, itineraryId } = req.body;
        
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        
        if (session.payment_status === 'paid' && session.client_reference_id === itineraryId) {
            
            // Unlock Database
            const itinerary = await Itinerary.findOneAndUpdate(
                { id: itineraryId },
                { unlocked: true },
                { new: true }
            );

            if (itinerary && itinerary.email) {
                const shareUrl = `${req.headers.origin || 'http://localhost:3000'}/?id=${itineraryId}`;
                const destination = itinerary.plan.destination;

                // SEND EMAIL 2: UNLOCKED
                await sendEmail(
                    itinerary.email,
                    `🔓 Full Itinerary Unlocked: ${destination}`,
                    `
                    <div style="font-family: sans-serif; color: #334155;">
                        <h1 style="color: #16a34a;">Payment Confirmed!</h1>
                        <h2>Your full itinerary for ${destination} is now available.</h2>
                        <p>You now have access to all days, hidden gems, and logistics details.</p>
                        <a href="${shareUrl}" style="background-color: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                            View Full Plan
                        </a>
                        <p style="margin-top:20px; font-size: 12px; color: #94a3b8;">Transaction ID: ${sessionId}</p>
                    </div>
                    `
                );
            }

            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Payment invalid or not completed' });
        }
    } catch (e) {
        console.error("Verification Error:", e);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// --- DB ROUTES ---

app.get('/api/itinerary/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const itinerary = await Itinerary.findOne({ id });

    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    let returnedPlan = itinerary.plan;
    if (!itinerary.unlocked && returnedPlan && Array.isArray(returnedPlan.days)) {
        returnedPlan = maskPlan(returnedPlan);
    }

    res.json({
      id: itinerary.id,
      unlocked: itinerary.unlocked,
      plan: returnedPlan,
      totalDays: itinerary.plan?.days?.length || 0,
      images: itinerary.images || {}
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch itinerary' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
