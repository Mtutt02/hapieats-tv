import { redirect } from 'next/navigation'

// Consolidated: edit a class in Academy Studio.
export default function EditCourseRedirect({ params }: { params: { id: string } }) {
  redirect(`/academy/${params.id}`)
}
