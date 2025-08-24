# --- deps build stage ---
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci

#builder stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

# Produces /dist
RUN npm run build

# production runner stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy minimal runtime files from deps stage 
COPY --from=builder /app/node_modules ./node_modules

# Copy built application files from the builder stage
COPY --from=builder /app/dist ./dist

COPY package*.json ./

EXPOSE 5090
CMD ["node", "dist/main.js"]
