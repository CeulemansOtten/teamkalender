"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"

type Person = {
  id: string
  name: string
  surname: string
}

export default function VacationsPage() {
  const [people, setPeople] = useState<Person[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, name, surname")

      if (error) {
        console.error("Supabase error:", error)
      } else {
        setPeople(data || [])
      }
    }

    fetchData()
  }, [])

  return (
    <div style={{ padding: 20 }}>
      <h1>Personeel</h1>
      <ul>
        {people.map((p) => (
          <li key={p.id}>
            {p.name} {p.surname}
          </li>
        ))}
      </ul>
    </div>
  )
}
