import { Folder } from 'lucide-react';

interface FolderMeta {
  id: number;
  name: string;
}

interface FolderTreeProps {
  folders: FolderMeta[];
  activeFolderId: number | null; // null = "All"
  onFolderSelect: (folderId: number | null) => void;
}

export function FolderTree({
  folders,
  activeFolderId,
  onFolderSelect,
}: FolderTreeProps) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Folders
      </div>
      <nav className="space-y-0.5">
        <button
          type="button"
          onClick={() => onFolderSelect(null)}
          className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${
            activeFolderId === null
              ? 'bg-primary/10 text-primary font-medium'
              : 'text-foreground hover:bg-muted'
          }`}
        >
          All Files
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => onFolderSelect(folder.id)}
            className={`w-full text-left text-sm px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
              activeFolderId === folder.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-foreground hover:bg-muted'
            }`}
          >
            <Folder className="h-4 w-4" />
            {folder.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
