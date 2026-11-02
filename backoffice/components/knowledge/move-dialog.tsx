"use client";

import { useMemo, useState } from "react";
import { CheckIcon, FolderIcon, HouseIcon, SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { placeLabel, type KnowledgeTree } from "@/lib/knowledge-tree";
import { cn } from "@/lib/utils";

/** What is being moved: a file, or a folder (which can't go into itself or a folder inside it). */
export type MoveRequest = {
  kind: "file" | "folder";
  id: string;
  name: string;
  /** Where it is now. Null is the root. */
  from: string | null;
};

/** "Mover a…": the folder picker for touch and keyboard users (drag and drop does the same). */
export function MoveDialog({
  tree,
  request,
  onMove,
  onClose,
}: {
  tree: KnowledgeTree;
  request: MoveRequest | null;
  onMove: (request: MoveRequest, to: string | null) => Promise<unknown>;
  onClose: () => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-md">
        {request ? (
          <MovePicker
            key={request.id}
            tree={tree}
            request={request}
            onMove={onMove}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MovePicker({
  tree,
  request,
  onMove,
  onClose,
}: {
  tree: KnowledgeTree;
  request: MoveRequest;
  onMove: (request: MoveRequest, to: string | null) => Promise<unknown>;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null | undefined>(
    undefined,
  );
  const [saving, setSaving] = useState(false);
  const query = search.trim().toLocaleLowerCase("es");

  const options = useMemo(() => {
    const all = [
      { id: null, name: "Conocimiento", depth: 0, path: "Conocimiento" },
      ...tree.ordered.map(({ folder, depth }) => ({
        id: folder.id as string | null,
        name: folder.name,
        depth: depth + 1,
        path: placeLabel(tree, folder.id),
      })),
    ];
    return all
      .filter(
        (option) =>
          !query || option.path.toLocaleLowerCase("es").includes(query),
      )
      .map((option) => {
        const inside =
          request.kind === "folder" &&
          option.id !== null &&
          tree.isSameOrInside(request.id, option.id);
        const here = option.id === request.from;
        return {
          ...option,
          disabled: inside || here,
          note: here ? "Está acá" : inside ? "Adentro de la carpeta" : null,
        };
      });
  }, [tree, request, query]);

  const move = async () => {
    if (selected === undefined || saving) return;
    setSaving(true);
    try {
      await onMove(request, selected);
      onClose();
    } catch {
      // The caller already showed why.
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader className="border-b p-4 pr-12">
        <DialogTitle className="truncate">
          Mover &quot;{request.name}&quot;
        </DialogTitle>
        <DialogDescription>
          Ahora está en {placeLabel(tree, request.from)}. Elegí a dónde va
          {request.kind === "folder" ? ", con todo lo que tiene adentro" : ""}.
        </DialogDescription>
      </DialogHeader>
      <div className="border-b p-3">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            autoFocus
            placeholder="Buscar carpeta"
            aria-label="Buscar carpeta"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </InputGroup>
      </div>
      <ul
        role="listbox"
        aria-label="Carpetas"
        className="flex max-h-[50vh] min-h-32 flex-col overflow-y-auto p-1.5"
      >
        {options.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            Ninguna carpeta coincide.
          </li>
        ) : null}
        {options.map((option) => {
          const active = selected === option.id;
          return (
            <li key={option.id ?? "root"}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                disabled={option.disabled}
                onClick={() => setSelected(option.id)}
                onDoubleClick={() => {
                  if (!option.disabled) {
                    setSelected(option.id);
                    void onMove(request, option.id).then(onClose, () => {});
                  }
                }}
                style={{
                  paddingLeft: query
                    ? undefined
                    : `${0.75 + Math.min(option.depth, 8) * 1}rem`,
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                  active ? "bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                {option.id === null ? (
                  <HouseIcon className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate">
                  {query ? option.path : option.name}
                  {option.id === null && !query ? (
                    <span className="text-muted-foreground"> (raíz)</span>
                  ) : null}
                </span>
                {option.note ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {option.note}
                  </span>
                ) : active ? (
                  <CheckIcon className="size-4 shrink-0" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <DialogFooter className="border-t p-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          disabled={selected === undefined || saving}
          onClick={() => void move()}
        >
          {saving ? <Spinner /> : null}
          Mover acá
        </Button>
      </DialogFooter>
    </>
  );
}
