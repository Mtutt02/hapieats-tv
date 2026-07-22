import { redirect } from 'next/navigation'

// Consolidated: unified class player lives under /academy/course/[id]/learn.
export default function LearnLessonRedirect({ params }: { params: { courseId: string } }) {
  redirect(`/academy/course/${params.courseId}/learn`)
}
