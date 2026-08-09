import { Redirect } from "expo-router";

// Legacy post-auth landing — routing is now handled by app/index.tsx.
// Kept as a harmless redirect so any old deep link resolves cleanly.
export default function Connected() {
  return <Redirect href="/" />;
}
