// Web stub — the native Google Sign-In SDK isn't available on web.
export async function googleSignIn(): Promise<void> {
  throw new Error("Google sign-in is available in the MentorForge app. Please use email on web.");
}

export async function googleSignOut(): Promise<void> {
  // no-op on web
}
