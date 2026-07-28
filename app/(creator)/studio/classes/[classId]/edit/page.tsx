import { redirect } from 'next/navigation'

// Consolidated: edit a class in Academy Studio.
export default function StudioEditClassRedirect({ params }: { params: { classId: string } }) {
  redirect(`/academy/${params.classId}`)
}
