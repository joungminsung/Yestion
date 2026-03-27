import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg"];

export const FileDrop = Extension.create({
  name: "fileDrop",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [new Plugin({
      key: new PluginKey("fileDrop"),
      props: {
        handleDrop(view, event) {
          const files = event.dataTransfer?.files;
          if (!files || files.length === 0) return false;

          event.preventDefault();

          // Get drop position
          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const insertPos = pos ? pos.pos : view.state.doc.content.size;

          Array.from(files).forEach(async (file) => {
            const formData = new FormData();
            formData.append("file", file);

            try {
              const res = await fetch("/api/upload", { method: "POST", body: formData });
              const data = await res.json();
              if (!data.url) return;

              let nodeType = "fileBlock";
              let attrs: Record<string, unknown> = { src: data.url, name: file.name, size: file.size, type: file.type };

              if (IMAGE_TYPES.includes(file.type)) {
                nodeType = "image";
                attrs = { src: data.url, alt: file.name };
              } else if (VIDEO_TYPES.includes(file.type)) {
                nodeType = "videoBlock";
                attrs = { src: data.url, title: file.name };
              } else if (AUDIO_TYPES.includes(file.type)) {
                nodeType = "audioBlock";
                attrs = { src: data.url, title: file.name };
              }

              editor.chain().focus().insertContentAt(insertPos, { type: nodeType, attrs }).run();
            } catch {
              // silently ignore upload errors
            }
          });

          return true;
        },

        // Show drop zone overlay on dragover
        handleDOMEvents: {
          dragover(view, event) {
            if (event.dataTransfer?.types.includes("Files")) {
              event.preventDefault();
              view.dom.classList.add("notion-file-dropzone");
            }
            return false;
          },
          dragleave(view, event) {
            // Only remove if leaving the editor
            const rect = view.dom.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
              view.dom.classList.remove("notion-file-dropzone");
            }
            return false;
          },
          drop(view) {
            view.dom.classList.remove("notion-file-dropzone");
            return false;
          },
        },
      },
    })];
  },
});
