# Fluxor Mini Frontend

A React/Next.js frontend for the Fluxor Mini micropayment asset exchange service. Convert your assets to XIN instantly with micropayments.

## Features

- 🔐 Mixin OAuth login integration
- 💼 Automatic wallet connection and asset retrieval
- 📊 Asset list sorted by USD value (highest to lowest)
- ✅ Selection of assets with total value < $10
- 🔄 Integration with Fluxor Mini backend for invoice generation
- 📱 Responsive design with Tailwind CSS

## Prerequisites

- Node.js 18+
- Mixin Developer Account with OAuth app
- Fluxor Mini Backend API

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fluxor-mini-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.local.example .env.local
   ```

   Edit `.env.local` with your configuration:
   ```env
   MIXIN_CLIENT_ID=your-mixin-client-id
   MIXIN_CLIENT_SECRET=your-mixin-client-secret
   MIXIN_SCOPE=PROFILE:READ ASSETS:READ
   FLUXOR_API_BASE_URL=http://localhost:3001
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Mixin OAuth Setup

1. Create a Mixin Developer account at [developers.mixin.one](https://developers.mixin.one)
2. Create a new OAuth app
3. Set the redirect URI to `http://localhost:3000/auth/callback`
4. Copy the Client ID and Client Secret to your `.env.local` file

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── auth/callback/     # OAuth callback page
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── AssetList.tsx      # Asset list with sorting
│   ├── AssetItem.tsx      # Individual asset item
│   ├── ExchangePanel.tsx  # Exchange interface
│   └── LoginButton.tsx    # Mixin login button
├── services/              # API service classes
│   ├── mixin.ts          # Mixin OAuth service
│   └── fluxor.ts         # Fluxor backend service
├── store/                 # Zustand state management
│   └── index.ts          # Global app store
└── types/                 # TypeScript type definitions
    └── index.ts
```

## Usage

1. **Login**: Click "Login with Mixin" to authenticate via Mixin OAuth
2. **View Assets**: Your assets are automatically loaded and sorted by USD value
3. **Select Assets**: Click on assets with value < $10 to select them for exchange
4. **Exchange**: Click "Exchange to XIN" to generate a payment invoice
5. **Complete Payment**: You'll be redirected to Mixin Messenger to complete the payment

## Supported Assets

The frontend supports all assets available in your Mixin wallet. The Fluxor Mini backend supports:

- Bitcoin (BTC)
- Ethereum (ETH)
- Tether USD (USDT)
- USD Coin (USDC)
- XIN

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Technologies Used

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Zustand** - State management
- **Mixin SDK** - Mixin network integration

## License

MIT