/**
 * NextAuth configuration - Credentials provider with session extended with role/ministry.
 *
 * Production: Set NEXTAUTH_SECRET to a strong random string (e.g. openssl rand -base64 32).
 */

import type { NextAuthOptions } from "next-auth";

const secret = process.env.NEXTAUTH_SECRET;
if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("NEXTAUTH_SECRET must be set in production");
}
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface Session {
    userId: string;
    roleId: string;
    roleSlug: string;
    ministryId: string | null;
    ministryIds: string[];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    roleId: string;
    roleSlug: string;
    ministryId: string | null;
    ministryIds: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    roleId: string;
    roleSlug: string;
    ministryId: string | null;
    ministryIds: string[];
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { role: true, userMinistries: { select: { ministryId: true } } },
        });
        if (!user || user.status !== "active") {
          return null;
        }
        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) {
          return null;
        }
        const ministryIds = user.userMinistries.map((um) => um.ministryId);
        if (user.ministryId && !ministryIds.includes(user.ministryId)) {
          ministryIds.push(user.ministryId);
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roleId: user.roleId,
          roleSlug: user.role.slug,
          ministryId: user.ministryId,
          ministryIds,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.roleId = user.roleId;
        token.roleSlug = user.roleSlug;
        token.ministryId = user.ministryId;
        token.ministryIds = user.ministryIds ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = token.userId;
        session.userId = token.userId;
        session.roleId = token.roleId;
        session.roleSlug = token.roleSlug;
        session.ministryId = token.ministryId;
        // Support legacy sessions: use ministryId if ministryIds is empty
        const ids = token.ministryIds ?? [];
        session.ministryIds = ids.length > 0 ? ids : token.ministryId ? [token.ministryId] : [];
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  secret: secret ?? "dev-fallback",
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
};
