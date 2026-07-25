import type { Metadata } from 'next'
import AppShell from '@/components/layout/AppShell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HapiEats TV',
  description: 'Flip through food channels — live streams, on-demand recipes, and more.',
}

export default async function TVPage() {
  return (
    <AppShell fullWidth>
      <div style={{minHeight:'80vh',background:'#000',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',padding:24}}>
        <span style={{fontSize:80}}>📺</span>
        <h1 style={{fontSize:28,fontWeight:'bold',marginTop:16}}>HapiEats TV</h1>
        <p style={{color:'#888',marginTop:8}}>TV experience loading...</p>
      </div>
    </AppShell>
  )
}
