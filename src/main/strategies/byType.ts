import * as path from 'path'
import { FileEntry, CategoryMap, OrganizationStrategy } from '../../../shared/ipc-types'

const CATEGORY_MAP: Record<string, string> = {
  // Documents
  pdf: 'Documents', doc: 'Documents', docx: 'Documents',
  xls: 'Documents', xlsx: 'Documents', ppt: 'Documents', pptx: 'Documents',
  odt: 'Documents', ods: 'Documents', odp: 'Documents',
  txt: 'Documents', rtf: 'Documents', md: 'Documents',
  csv: 'Documents', pages: 'Documents', numbers: 'Documents', key: 'Documents',
  // Photos
  jpg: 'Photos', jpeg: 'Photos', png: 'Photos', gif: 'Photos',
  webp: 'Photos', heic: 'Photos', heif: 'Photos', bmp: 'Photos',
  tiff: 'Photos', tif: 'Photos', svg: 'Photos', ico: 'Photos',
  raw: 'Photos', cr2: 'Photos', nef: 'Photos', arw: 'Photos',
  // Music
  mp3: 'Music', flac: 'Music', aac: 'Music', wav: 'Music',
  ogg: 'Music', m4a: 'Music', wma: 'Music', opus: 'Music', aiff: 'Music',
  // Video
  mp4: 'Video', mov: 'Video', avi: 'Video', mkv: 'Video',
  wmv: 'Video', flv: 'Video', webm: 'Video', m4v: 'Video',
  mpg: 'Video', mpeg: 'Video', '3gp': 'Video',
  // Archives
  zip: 'Archives', rar: 'Archives', '7z': 'Archives',
  tar: 'Archives', gz: 'Archives', bz2: 'Archives',
  xz: 'Archives', iso: 'Archives', dmg: 'Archives', cab: 'Archives',
}

export function getCategory(filename: string): string {
  const ext = path.extname(filename).toLowerCase().replace('.', '')
  return CATEGORY_MAP[ext] ?? 'Other'
}

export class ByTypeStrategy implements OrganizationStrategy {
  readonly name = 'By Type'

  categorize(files: FileEntry[], _targetDir: string): CategoryMap {
    const map: CategoryMap = {}
    for (const file of files) {
      const category = getCategory(file.name)
      if (!map[category]) map[category] = []
      map[category].push(file)
    }
    return map
  }
}
