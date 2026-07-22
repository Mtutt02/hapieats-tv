import { redirect } from 'next/navigation'

// Consolidated: unified class player lives under /academy/course/[id]/learn.
export default function LearnRedirect({ params }: { params: { courseId: string } }) {
  redirect(`/academy/course/${params.courseId}/learn`)
}
