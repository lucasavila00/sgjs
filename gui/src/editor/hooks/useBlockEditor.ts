import { useEditor } from "@tiptap/react";
import { Document as TiptapDocument } from "@tiptap/extension-document";
import { Heading } from "../extensions/Heading";
import { Dropcursor } from "@tiptap/extension-dropcursor";
import { Placeholder } from "@tiptap/extension-placeholder";
import { FocusClasses as Focus } from "@tiptap/extension-focus";
import { HorizontalRule } from "../extensions/HorizontalRule";
import { SlashCommand } from "../extensions/SlashCommand";
import StarterKit from "@tiptap/starter-kit";
import { Selection } from "../extensions/Selection";
import { AuthorSelect } from "../extensions/AuthorSelect/AuthorSelect";
import { TrailingNode } from "../extensions/TrailingNode";
import { initialContent } from "./init";
import { useVariables } from "./useVariables";
import { VariableSelect } from "../extensions/VariableSelect/VariableSelect";
import { LmGenerator } from "../extensions/LmGenerator/LmGenerator";
import { useSamplingParams } from "./useSamplingParams";
import { useCallback, useState } from "react";

const Doc = TiptapDocument.extend({
  content: "authorSelect block*",
});

type SidebarState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const useSidebar = (initialState: boolean): SidebarState => {
  const [isOpen, setIsOpen] = useState(initialState);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
};

export const useBlockEditor = () => {
  const [isExecuting, setIsExecuting] = useState(false);
  const toggleExecuting = useCallback(() => {
    setIsExecuting((prev) => !prev);
  }, [setIsExecuting]);
  const rightSidebar = useSidebar(true);

  const variablesHook = useVariables(initialContent.variables);
  const samplingParamsHook = useSamplingParams(initialContent.samplingParams);

  const editor = useEditor(
    {
      autofocus: true,
      content: initialContent.doc,
      extensions: [
        StarterKit.configure({
          document: false,
          dropcursor: false,
          heading: false,
          horizontalRule: false,
          blockquote: false,
          codeBlock: false,
          bold: false,
          code: false,
          gapcursor: false,
          strike: false,
          italic: false,
          // hard break??
          hardBreak: undefined,

          // these use default
          history: undefined,
          listItem: undefined,
          orderedList: undefined,
          paragraph: undefined,
          text: undefined,
          bulletList: undefined,
        }),
        // TiptapDocument,
        Doc,
        Heading,
        Dropcursor.configure({
          width: 2,
          class: "ProseMirror-dropcursor border-black",
        }),
        Placeholder.configure({
          includeChildren: true,
          showOnlyCurrent: false,
          placeholder: () => "",
        }),
        Focus,
        HorizontalRule,
        SlashCommand,
        Selection,
        AuthorSelect,
        TrailingNode,
        VariableSelect,
        LmGenerator,
      ],
      editorProps: {
        attributes: {
          autocomplete: "off",
          autocorrect: "off",
          autocapitalize: "off",
          class: "min-h-full",
        },
      },
    },
    [],
  );

  return {
    editor,
    rightSidebar,
    variablesHook,
    samplingParamsHook,
    isExecuting,
    toggleExecuting,
  };
};
