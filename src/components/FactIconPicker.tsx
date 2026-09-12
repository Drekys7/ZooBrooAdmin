import { Globe, Hourglass, Info, Utensils, Weight } from 'lucide-react'

export const factIconChoices = [
  { id: 'zooweb-fact-region', label: 'Region', Icon: Globe, file: 'region' },
  { id: 'zooweb-fact-lifespan', label: 'Lebensdauer', Icon: Hourglass, file: null },
  { id: 'zooweb-fact-weight', label: 'Gewicht', Icon: Weight, file: 'weight' },
  { id: 'zooweb-fact-food', label: 'Nahrung', Icon: Utensils, file: 'food-type' },
  { id: '', label: 'Information', Icon: Info, file: null },
]

export function FactIconPicker({ value, label, assetUrls, onChange, customIcons = [] }: {
  value?: string | null
  label: string
  assetUrls: Record<string, string>
  onChange: (value: string | null) => void
  customIcons?: Array<{ id: string; label: string }>
}) {
  const choices = [...factIconChoices, ...customIcons.map(entry => ({ ...entry, Icon: Info, file: null }))]
  const choice = choices.find((entry) => entry.id === (value ?? ''))
  const Icon = choice?.Icon ?? Info
  const url = choice?.file ? assetUrls[choice.id] ?? `/zooweb/facts/${choice.file}.png` : value && value !== 'zooweb-fact-lifespan' ? assetUrls[value] : undefined
  return <label className="fact-icon-picker" title="Symbol auswählen">
    {url ? <span className="fact-icon-picker__image" style={{ maskImage: `url(${JSON.stringify(url)})`, WebkitMaskImage: `url(${JSON.stringify(url)})` }} aria-hidden="true" /> : <Icon size={19} strokeWidth={2} aria-hidden="true" />}
    <select aria-label={`Symbol für ${label || 'Information'}`} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
      {!choice && <option value={value ?? ''}>Benutzerdefiniert</option>}
      {choices.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
    </select>
  </label>
}
