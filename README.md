# IDLE FIGHT CLUB

An async, hyper-local "idle fight club" for apartment complexes. Users create anonymous avatars, go offline with a custom personality prompt, and other players' browsers use **local AI (WebLLM + WebGPU)** to generate brutal, comedic trash talk encounters — no server-side AI costs.

---

## Step 1: Initialization Commands

```bash
# If starting from scratch (the project is already bootstrapped in this folder):
npx create-next-app@14.2.21 idle-fight-club --js --tailwind --eslint --app --src-dir=false --import-alias="@/*"

cd idle-fight-club

# Install dependencies
npm install mongoose @mlc-ai/web-llm stripe

# (Tailwind, PostCSS, autoprefixer already included by create-next-app)
```

If you're using **this pre-built codebase**, just run:

```bash
cd idle-fight-club
npm install
```

---

## Step 2: MongoDB Setup

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/) and create a free M0 cluster.
2. Create a database user and whitelist `0.0.0.0/0` for network access.
3. Get the connection string and put it in `.env.local`:

```
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/idle-fight-club?retryWrites=true&w=majority
```

The schemas are in `/models/User.js` and `/models/DramaLog.js`. Mongoose auto-creates collections on first write.

---

## Step 3: Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in **Chrome 113+** (WebGPU required).

---

## Step 4: Deploy to Vercel via CLI

### Push to GitHub first:

```bash
# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit: idle fight club"

# Create a GitHub repo and push using gh CLI
gh repo create idle-fight-club --public --source=. --remote=origin --push
```

### Deploy to Vercel:

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Deploy (first time — will prompt for project setup)
vercel

# IMPORTANT: Set ALL env variables
vercel env add MONGODB_URI
vercel env add STRIPE_SECRET_KEY
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add STRIPE_MONTHLY_PRICE_ID
vercel env add STRIPE_ANNUAL_PRICE_ID
vercel env add NEXT_PUBLIC_APP_URL  # set to your production URL

# Deploy to production
vercel --prod
```

### Stripe Webhook Setup:

After deploying, create a webhook endpoint in Stripe Dashboard:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://your-app.vercel.app/api/stripe/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
4. Copy the signing secret and set it as `STRIPE_WEBHOOK_SECRET`

### Stripe Products Setup:

Create two prices in Stripe Dashboard → Products:
1. **Monthly Plan**: $1.00/month recurring → copy the Price ID
2. **Annual Plan**: $10.00 every 13 months recurring → copy the Price ID

### Or via Vercel Dashboard:

1. Go to [vercel.com](https://vercel.com) → Import Git Repository → select `idle-fight-club`
2. In **Settings → Environment Variables**, add all the env vars from `.env.local`
3. Deploy.

---

## Architecture

```
idle-fight-club/
├── app/
│   ├── api/
│   │   ├── users/
│   │   │   ├── route.js         # GET all users, POST register/login
│   │   │   ├── move/route.js    # PATCH update position
│   │   │   └── status/route.js  # PATCH toggle online + away prompt
│   │   ├── drama/
│   │   │   ├── route.js         # GET all logs, POST new drama
│   │   │   └── user/route.js    # GET logs for specific user
│   │   └── stripe/
│   │       ├── checkout/route.js # POST create checkout session
│   │       ├── webhook/route.js  # POST Stripe webhook handler
│   │       └── status/route.js   # GET subscription status
│   ├── globals.css
│   ├── layout.js
│   └── page.js                  # Main game client
├── components/
│   ├── Grid.js                  # 20x20 CSS grid
│   ├── DramaFeed.js             # Drama log viewer
│   └── LoadingScreen.js         # WebLLM download progress
├── hooks/
│   └── useWebLLM.js             # WebLLM engine + trash talk generation
├── lib/
│   └── mongodb.js               # Mongoose connection singleton
├── models/
│   ├── User.js                  # User schema
│   └── DramaLog.js              # Drama log schema
└── .env.local                   # MONGODB_URI goes here
```

---

## How It Works

1. User picks a username, floor, and emoji — saved to MongoDB.
2. The browser downloads a 3B-parameter LLM (~1.5GB, cached after first load) via WebGPU.
3. On the 20x20 grid, users move with arrow keys / WASD.
4. When an online user steps next to an offline user's avatar, the AI generates trash talk using the offline user's "Away Prompt" as character context.
5. The drama transcript is saved to MongoDB so the offline user can read it later.

**No server-side AI inference. No API keys. Pure browser-local chaos.**
