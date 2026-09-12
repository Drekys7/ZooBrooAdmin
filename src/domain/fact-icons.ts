import type { MapFact, MapProject } from './models'

export function removeFactIcon(project: MapProject, id: string): MapProject {
  if (!project.mapSettings.factIcons?.some(icon => icon.id === id)) return project
  const clear = (facts: MapFact[]) => facts.map(fact => fact.iconAssetId === id ? { ...fact, iconAssetId: null } : fact)
  return {
    ...project,
    mapSettings: { ...project.mapSettings, factIcons: project.mapSettings.factIcons.filter(icon => icon.id !== id) },
    items: project.items.map(item => ({ ...item, facts: clear(item.facts),
      ...(item.members ? { members: item.members.map(member => ({ ...member, facts: clear(member.facts) })) } : {}),
    })),
  }
}
