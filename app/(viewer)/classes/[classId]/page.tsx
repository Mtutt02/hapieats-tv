import { redirect } from 'next/navigation'

// Consolidated: individual classes now live on the unified course viewer.
export default function LegacyClassRedirect({ params }: { params: { classId: string } }) {
  redirect(`/academy/course/${params.classId}`)
}
