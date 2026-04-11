/**
 * NextAuth configuration - Credentials provider with session extended for
 * the per-ministry role model.
 *
 * Production: Set NEXTAUTH_SECRET to a strong random string.
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
    isAdmin: boolean;
    status: "pending" | "active" | "inactive";
    ministryIds: string[];
    headOfMinistryIds: string[];
  }

  interface User {
    id: string;
    email: string;
    name: string;
    isAdmin: boolean;
    status: "pending" | "active" | "inactive";
    ministryIds: string[];
    headOfMinistryIds: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    isAdmin: boolean;
    status: "pending" | "active" | "inactive";
    ministryIds: string[];
    headOfMinistryIds: string[];
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
          include: {
            userMinistries: { select: { ministryId: true, role: true } },
          },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.hashedPassword);
        if (!valid) return null;

        // Inactive users are rejected here. Pending users ARE allowed through —
        // the dashboard layout redirects them to /pending with a clear message.
        if (user.status === "inactive") return null;

        const ministryIds = user.userMinistries.map((um) => um.ministryId);
        const headOfMinistryIds = user.userMinistries
          .filter((um) => um.role === "head")
          .map((um) => um.ministryId);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
          status: user.status,
          ministryIds,
          headOfMinistryIds,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial login
        token.userId = user.id;
        token.isAdmin = user.isAdmin;
        token.status = user.status;
        token.ministryIds = user.ministryIds ?? [];
        token.headOfMinistryIds = user.headOfMinistryIds ?? [];
        return token;
      }
      // Subsequent requests — re-read fresh state so role/status changes
      // propagate immediately without requiring re-login. Cost: one Prisma
      // query per server request that resolves a session.
      if (token.userId) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.userId },
          select: {
            isAdmin: true,
            status: true,
            userMinistries: { select: { ministryId: true, role: true } },
          },
        });
        if (!fresh) {
          // User was deleted — invalidate token by returning an empty shape.
          // The session callback's `if (token.userId)` guard treats this as
          // "no session" downstream.
          return {} as typeof token;
        }
        token.isAdmin = fresh.isAdmin;
        token.status = fresh.status;
        token.ministryIds = fresh.userMinistries.map((um) => um.ministryId);
        token.headOfMinistryIds = fresh.userMinistries
          .filter((um) => um.role === "head")
          .map((um) => um.ministryId);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        (session.user as { id?: string }).id = token.userId;
        session.userId = token.userId;
        session.isAdmin = token.isAdmin ?? false;
        session.status = token.status ?? "active";
        session.ministryIds = token.ministryIds ?? [];
        session.headOfMinistryIds = token.headOfMinistryIds ?? [];
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
