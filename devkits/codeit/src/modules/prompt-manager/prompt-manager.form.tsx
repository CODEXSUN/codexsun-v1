import { useState, type FormEvent } from "react";
import { Button } from "@codexsun/ui/components/button";
import { Input } from "@codexsun/ui/components/input";
import { Textarea } from "@codexsun/ui/components/textarea";
import { WorkspaceLookup } from "@codexsun/ui/workspace/lookup";
import { WorkspaceStatusToggle } from "@codexsun/ui/workspace/status";
import {
  WorkspaceUpsertPage,
  WorkspaceFormSurface,
  WorkspaceFormBody,
  WorkspaceFormGrid,
  WorkspaceFormField,
  WorkspaceFormActions,
  WorkspaceFormBanner
} from "@codexsun/ui/workspace/upsert";
import { promptManagerSchema } from "./prompt-manager.schema";
import type { CodexChat, PromptPayload, PromptRecord } from "./prompt-manager.types";

export function PromptManagerForm({
  record,
  chats,
  busy,
  error,
  onSave,
  onCancel
}: {
  record: PromptRecord | null;
  chats: CodexChat[];
  busy: boolean;
  error: string;
  onSave: (value: PromptPayload) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState<PromptPayload>(
    record ?? { title: "", category: "", content: "", threadId: "", threadName: "", active: true }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = promptManagerSchema.safeParse({
      title: value.title,
      category: value.category,
      content: value.content,
      threadId: value.threadId,
      threadName: value.threadName,
      active: value.active
    });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])
        )
      );
      return;
    }
    setErrors({});
    onSave(parsed.data);
  }
  const fieldError = (field: string) =>
    errors[field] ? (
      <p className="text-sm text-destructive" role="alert">
        {errors[field]}
      </p>
    ) : null;
  const chatOptions = chats.map((chat) => ({
    value: chat.id,
    label: chat.name,
    description: chat.cwd
  }));
  if (value.threadId && !chatOptions.some((chat) => chat.value === value.threadId))
    chatOptions.push({ value: value.threadId, label: value.threadName, description: "Saved chat" });
  return (
    <WorkspaceUpsertPage
      title={record ? "Edit prompt" : "New prompt"}
      description="Save instructions once, then reuse them in your Codex chats."
      onBack={onCancel}
    >
      <WorkspaceFormSurface>
        <form noValidate onSubmit={submit}>
          <WorkspaceFormBody>
            <div className="grid gap-5">
              {(error || Object.keys(errors).length > 0) && (
                <WorkspaceFormBanner title="Unable to save prompt">
                  {error || "Check the highlighted fields and try again."}
                </WorkspaceFormBanner>
              )}
              <WorkspaceFormGrid>
                <WorkspaceFormField label="Title" required>
                  <Input
                    aria-label="Title"
                    aria-invalid={Boolean(errors.title)}
                    className={errors.title ? "border-destructive" : ""}
                    value={value.title}
                    onChange={(event) => setValue({ ...value, title: event.target.value })}
                    placeholder="e.g. Review a focused change"
                  />
                  {fieldError("title")}
                </WorkspaceFormField>
                <WorkspaceFormField label="Category">
                  <Input
                    aria-label="Category"
                    aria-invalid={Boolean(errors.category)}
                    value={value.category}
                    onChange={(event) => setValue({ ...value, category: event.target.value })}
                    placeholder="e.g. Development, Review, Release"
                  />
                  {fieldError("category")}
                </WorkspaceFormField>
              </WorkspaceFormGrid>
              <WorkspaceFormField label="Prompt" required>
                <Textarea
                  aria-label="Prompt"
                  aria-invalid={Boolean(errors.content)}
                  className={`min-h-64 font-mono text-sm leading-6 ${errors.content ? "border-destructive" : ""}`}
                  value={value.content}
                  onChange={(event) => setValue({ ...value, content: event.target.value })}
                  placeholder="Write the instructions you want to reuse…"
                />
                {fieldError("content")}
              </WorkspaceFormField>
              <WorkspaceFormGrid>
                <WorkspaceFormField label="Default Codex chat">
                  <WorkspaceLookup
                    ariaLabel="Default Codex chat"
                    allowTextValue={false}
                    value={value.threadId}
                    options={chatOptions}
                    placeholder="Choose a chat (optional)"
                    onValueChange={(threadId, option) =>
                      setValue({ ...value, threadId, threadName: option?.label ?? "" })
                    }
                  />
                </WorkspaceFormField>
                <WorkspaceFormField label="Status">
                  <div className="flex min-h-11 items-center">
                    <WorkspaceStatusToggle
                      active={value.active}
                      onClick={() => setValue({ ...value, active: !value.active })}
                    />
                  </div>
                </WorkspaceFormField>
              </WorkspaceFormGrid>
            </div>
          </WorkspaceFormBody>
          <WorkspaceFormActions>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : record ? "Update" : "Save"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          </WorkspaceFormActions>
        </form>
      </WorkspaceFormSurface>
    </WorkspaceUpsertPage>
  );
}
