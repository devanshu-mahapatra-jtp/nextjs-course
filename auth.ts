import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';

// Configure neon to use ws for WebSocket
neonConfig.webSocketConstructor = ws;

// If in development, use the WebSocket proxy
if (process.env.VERCEL_ENV === "development") {
  neonConfig.wsProxy = (host) => `${host}:54330/v1`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

// Create a new pool using the connection string from your .env file
const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

async function getUser(email: string): Promise<User | undefined> {
  try {
    const client = await pool.connect();
    const user = await client.query('SELECT * FROM users WHERE email = $1', [email]);
    client.release();
    return user.rows[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (passwordsMatch) return user;
        }
        console.log('Invalid credentials');

        return null;
      },
    }),
  ],
});