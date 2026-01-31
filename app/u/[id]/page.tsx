'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

type Block = {
  id: string
  text: string
  url: string
}

export default function PublicPage() {
  const params = useParams()
  const id = params.id as string

  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('pages1')
        .select('*')
        .eq('id', id)
        .single()

      setData(data)
    }

    load()
  }, [id])

  if (!data) return <div className="text-center mt-20">Загрузка...</div>

  return (
    <main className="min-h-screen bg-black text-white flex justify-center">
      <div className="w-full max-w-md px-4 py-10">
        <h1 className="text-3xl font-bold text-center mb-8">
          {data.title}
        </h1>

        <div className="space-y-4">
          {data.blocks.map((b: Block) => (
            <a
              key={b.id}
              href={b.url}
              target="_blank"
              className="block w-full text-center py-4 rounded-2xl bg-white text-black font-medium transition hover:scale-[1.02]"
            >
              {b.text}
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
