import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function POST() {
  const supabase = await createClient()

  // Use getUser() for secure server-side verification (recommended over getSession)
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    await supabase.auth.signOut()
  }

  // Read locale from the NEXT_LOCALE cookie so we redirect to the correct locale login
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value || 'en'

  revalidatePath('/', 'layout')
  redirect(`/${locale}/login`)
}
