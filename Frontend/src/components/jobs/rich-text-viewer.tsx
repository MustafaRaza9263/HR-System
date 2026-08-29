"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

import type { RichTextDoc } from "@/lib/jobs/types";
import { emptyRichTextDoc } from "@/lib/jobs/types";

interface RichTextViewerProps {
  value: RichTextDoc;
  className?: string;
}

export function RichTextViewer({ value, className = "" }: RichTextViewerProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value ?? emptyRichTextDoc(),
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "text-sm leading-6 text-gray-800 dark:text-gray-200 [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(value ?? emptyRichTextDoc());
  }, [editor, value]);

  if (!editor) return null;
  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  );
}
