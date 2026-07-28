import { redirect } from 'next/navigation'

// Consolidated: unified course/class viewer lives under /academy/course.
export default function CourseDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/academy/course/${params.id}`)
}
