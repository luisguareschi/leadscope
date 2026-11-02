"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

export type NameRequest = {
  title: string;
  description?: string;
  label: string;
  /** Starting value, without the extension. */
  initial: string;
  /** A file's extension, shown after the input and kept on rename. */
  extension?: string;
  placeholder?: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<unknown>;
};

/** Splits "Precios 2027.xlsx" into "Precios 2027" and ".xlsx". */
export function splitExtension(name: string): [string, string] {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
}

/** One text field for a new folder's name, or a new name for a folder or file. */
export function NameDialog({
  request,
  onClose,
}: {
  request: NameRequest | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {request ? (
          <NameForm
            key={`${request.title}:${request.initial}`}
            request={request}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function NameForm({
  request,
  onClose,
}: {
  request: NameRequest;
  onClose: () => void;
}) {
  const [value, setValue] = useState(request.initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const trimmed = value.trim();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!trimmed || saving) return;
        setSaving(true);
        setError(null);
        try {
          await request.onSubmit(`${trimmed}${request.extension ?? ""}`);
          onClose();
        } catch (failure) {
          setError(
            failure instanceof Error ? failure.message : "No se pudo guardar.",
          );
        } finally {
          setSaving(false);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{request.title}</DialogTitle>
        {request.description ? (
          <DialogDescription>{request.description}</DialogDescription>
        ) : null}
      </DialogHeader>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="knowledge-name">{request.label}</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="knowledge-name"
            autoFocus
            autoComplete="off"
            maxLength={200}
            value={value}
            placeholder={request.placeholder}
            aria-invalid={error ? true : undefined}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
          />
          {request.extension ? (
            <InputGroupAddon align="inline-end">
              <InputGroupText>{request.extension}</InputGroupText>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!trimmed || saving}>
          {saving ? <Spinner /> : null}
          {request.submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
