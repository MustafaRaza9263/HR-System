"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
} from "lucide-react";
import { useEffect } from "react";

import type { RichTextDoc } from "@/lib/jobs/types";
import { emptyRichTextDoc } from "@/lib/jobs/types";

interface RichTextEditorProps {
  value: RichTextDoc;
  onChange: (doc: Exclude<RichTextDoc, null>, plain: string) => void;
  editable?: boolean;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  editable = true,
  placeholder = "Describe the role, responsibilities, and requirements…",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value ?? emptyRichTextDoc(),
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-48 max-h-80 overflow-y-auto px-4 py-3 text-sm leading-6 text-gray-900 outline-none dark:text-white [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor: current }) => {
      onChange(current.getJSON() as Exclude<RichTextDoc, null>, current.getText());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = value ?? emptyRichTextDoc();
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(next)) {
      editor.commands.setContent(next);
    }
  }, [editor, value]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return <div className="h-64 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800" />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
      {editable ? (
        <div className="flex flex-wrap gap-1 border-b border-gray-200 bg-gray-50 px-2 py-2 dark:border-gray-700 dark:bg-gray-900/60">
          <ToolbarButton
            active={editor.isActive("bold")}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("italic")}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("heading", { level: 2 })}
            label="Heading"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("bulletList")}
            label="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive("orderedList")}
            label="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
        </div>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolbarButton({
  children,
  active,
  label,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={`grid h-8 w-8 place-items-center rounded-lg transition ${active ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" : "text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800"}`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
