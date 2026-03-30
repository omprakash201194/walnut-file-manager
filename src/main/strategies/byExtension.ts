import * as path from 'path'
import { FileEntry, CategoryMap, OrganizationStrategy } from '../../../shared/ipc-types'

export class ByExtensionStrategy implements OrganizationStrategy {
  readonly name = 'By Extension'

  categorize(files: FileEntry[], _targetDir: string): CategoryMap {
    const map: CategoryMap = {}
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase().replace('.', '') || 'no-extension'
      if (!map[ext]) map[ext] = []
      map[ext].push(file)
    }
    return map
  }
}
