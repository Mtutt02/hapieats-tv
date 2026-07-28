import { redirect } from 'next/navigation'

// Consolidated: "Courses" is now unified under Classes.
export default function CoursesRedirect() {
  redirect('/classes')
}
