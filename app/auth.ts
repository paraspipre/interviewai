
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
 
export const { signIn, signOut, auth ,handlers} = NextAuth({
  secret: process.env.AUTH_SECRET,
  
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID as string,
      clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
    }),
  ],
})
