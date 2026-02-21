import { DefaultSession } from "next-auth";

// Extend the built-in session type to include the user's database id.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
