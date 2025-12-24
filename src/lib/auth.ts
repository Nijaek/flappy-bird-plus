import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Find user with password
        const account = await prisma.account.findFirst({
          where: {
            provider: 'credentials',
            user: { email },
          },
          include: { user: true },
        });

        if (!account || !account.access_token) {
          return null;
        }

        // Verify password (stored in access_token field for credentials)
        const isValid = await bcrypt.compare(password, account.access_token);
        if (!isValid) {
          return null;
        }

        return {
          id: account.user.id,
          email: account.user.email,
          name: account.user.name,
          image: account.user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('[auth] signIn callback:', { user, account: account?.provider, profile: profile?.email });

      // Allow OAuth sign-in even if an account with same email exists
      // This links the OAuth account to the existing user
      if (account?.provider === 'google' && profile?.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.email as string },
          include: { accounts: true },
        });

        if (existingUser) {
          // Check if Google account is already linked
          const googleAccount = existingUser.accounts.find(a => a.provider === 'google');
          if (!googleAccount) {
            // Link the Google account to existing user
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
              },
            });
            // Update user info from Google profile
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                name: profile.name as string,
                image: profile.picture as string,
              },
            });
          }
          // Set the user id so JWT callback uses the existing user
          user.id = existingUser.id;
        }
      }

      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
      }
      // Fetch displayName from database on sign in or when session is updated
      if (token.id && (user || trigger === 'update')) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { displayName: true },
        });
        token.displayName = dbUser?.displayName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.displayName = token.displayName as string | null | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
});
