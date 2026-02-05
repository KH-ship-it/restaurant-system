import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  // Providers
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null
        }

        try {
          // Gọi API backend để xác thực
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({
              username: credentials.username,
              password: credentials.password
            }),
            headers: { "Content-Type": "application/json" }
          })
          const user = await res.json()
          
          // Nếu đăng nhập thành công, return user
          if (res.ok && user) {
            return {
              id: user.id || user.employeeId || "1",
              name: user.full_name || user.username,
              email: user.email || "",
              token: user.token,
              role: user.role
            }
          }
          
          return null
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    }),
  ],

  secret: process.env.NEXTAUTH_SECRET,

  // Trang đăng nhập tùy chỉnh
  pages: {
    signIn: "/vi/login",
    error: "/vi/login",
  },
  // Session config (JWT hoặc database)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 ngày
  },

  // Callbacks tùy chỉnh
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.token = (user as any).token
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (token?.id) {
        // Fix lỗi TypeScript bằng cách tạo object mới
        return {
          ...session,
          user: {
            ...session.user,
            id: token.id as string,
          },
          token: token.token as string | undefined,
          role: token.role as string | undefined,
        }
      }
      return session
    },
  },

  // Debug mode (bật khi dev)
  debug: process.env.NODE_ENV === "development",
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }