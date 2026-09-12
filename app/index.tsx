import { Redirect } from 'expo-router';

// architecture.md's repo structure names the file (tabs)/home.tsx (not
// index.tsx), so the root route redirects into it rather than renaming.
export default function RootIndex() {
  return <Redirect href="/home" />;
}
