import { redirect } from 'next/navigation'

// Moved to /tv — sidebar links there
export default function WatchTVRedirect() {
  redirect('/tv')
}
